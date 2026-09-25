# Code signing — the procedure, for whoever signs

**Status: not done.** Code signing was out of M9 and **out of M10** by the
product owner's call (2026-09-25). v1.0.0 ships unsigned. This file is the
procedure for whoever signs a later build, written down at M10 so it does not
have to be rediscovered. Nothing in the repository, `tauri.conf.json` or CI has
been changed for it.

**Who can do this.** Only someone who holds the certificates. An agent does not
buy or create them. **Never commit a key, a certificate or a password.**
Everything below reads them from GitHub Actions secrets that the product owner
adds, or from the signing machine's own keychain or certificate store.

---

## What an unsigned build costs the teacher today

- **Windows:** a file that carries Mark of the Web stops at SmartScreen's *"Windows
  protected your PC"* on its first double-click. The teacher has to choose
  *More info → Run anyway*. That was seen on a physical machine at M1 and in the
  VM at M4.5. A file gets Mark of the Web when it is downloaded or emailed, and
  some sync clients add it too. The spec's Carried risks has the detail.
- **macOS:** Gatekeeper refuses an unsigned, unnotarized app on its first
  double-click. The teacher has to use *right-click → Open*.

The teacher-facing guide (`docs/user/getting-started.md`) tells her to expect
both.

## What has to be signed

The teacher runs the app **from the synced folder**, not from an installed copy
(see "The installer and the .dmg" below). So signing has to cover **the files
she double-clicks there**:

- **Windows:** `teacher-planner.exe` itself, not only the NSIS installer. When
  Windows signing is configured, Tauri signs the app binary and the installer
  during `tauri build`. Check both.
- **macOS:** `Teacher Planner.app`, the universal bundle, with both of its
  slices. Tauri signs it with the hardened runtime when a signing identity is
  configured. The `.dmg` is signed separately.

## Windows

### Choosing a certificate — the product owner's decision

| Kind | How it is held | Usable from CI? |
|---|---|---|
| **OV** (organisation-validated) Authenticode | A `.pfx` file and its password. Newer OV certificates may also have to live on a hardware token or cloud HSM, depending on the issuer | Yes, if it is a `.pfx`: store it base64-encoded in a secret |
| **EV** (extended validation) | Always on a hardware token or cloud HSM | Only through the vendor's cloud-signing service, not from a plain secret |
| **Azure Trusted Signing** | A Microsoft-managed signing account and certificate profile. Nothing is exported | Yes, through Azure credentials stored as secrets |

**Do not assume any of them removes SmartScreen on day one.** SmartScreen
builds reputation for a publisher and a file over time. Whatever is chosen, the
only proof is the Mark-of-the-Web double-click at the end of this file.

### Configuring Tauri

For a certificate in the Windows certificate store (OV `.pfx` imported on the
build machine), `src-tauri/tauri.conf.json` gets a `bundle.windows` section:

```json
"windows": {
  "certificateThumbprint": "<thumbprint of the imported certificate>",
  "digestAlgorithm": "sha256",
  "timestampUrl": "<the issuer's RFC 3161 timestamp URL>"
}
```

A thumbprint is not a secret. The certificate and its password are.

For Azure Trusted Signing, or any signer driven by a command, use
`bundle.windows.signCommand` instead. Tauri runs that command once for each file
it signs, with the file's path in place of `%1`. The command itself is whatever
the signing service documents.

### In CI

In `.github/workflows/ci.yml`, **only on the Windows job and only when the
secrets exist** (so forks and pull requests without secrets still build
unsigned):

1. Decode the `.pfx` from a secret into a temporary file, and import it into
   `Cert:\CurrentUser\My` with `Import-PfxCertificate`, using the password
   secret.
2. Run `npm run tauri build` as now.
3. Delete the temporary file whatever the outcome.

Suggested secret names: `WINDOWS_CERTIFICATE` (the base64 `.pfx`) and
`WINDOWS_CERTIFICATE_PASSWORD`. For Azure Trusted Signing, use the Azure
client id, tenant id, secret, endpoint, account and profile names.

**Do not revive the old Mark-of-the-Web "tripwire".** It launched a tagged exe
with `Start-Process` on a headless runner and never measured SmartScreen.
`Start-Process` does not trigger SmartScreen, and a headless runner has no
desktop to show it on. It was retired at M1. A green CI run proves only that a
file was signed, not that SmartScreen is gone.

### Proving it

On Windows, for **both** `teacher-planner.exe` and the installer:

```powershell
Get-AuthenticodeSignature .\teacher-planner.exe | Format-List Status, SignerCertificate, TimeStamperCertificate
# Status must be Valid, and there must be a timestamp: an untimestamped
# signature stops validating the day the certificate expires.
```

Then **the only test that proves SmartScreen is gone**, which needs a person:

1. Copy the signed `teacher-planner.exe` to a fresh folder.
2. Give it Mark of the Web. A file built locally has none, so without this step
   a double-click proves nothing:
   ```powershell
   Set-Content -Path .\teacher-planner.exe -Stream Zone.Identifier -Value "[ZoneTransfer]`r`nZoneId=3"
   ```
3. **Double-click it in Explorer.** No scripted launch counts: `Start-Process`,
   `Shell.InvokeVerb` and a scheduled task all skip SmartScreen.
4. Record exactly what appeared. For a signed file SmartScreen names the
   publisher. Do the same for the installer.

Do it in the `MilestoneTesting` VM after reverting to `clean-baseline`.
SmartScreen remembers a *Run anyway* per file (see `docs/WINDOWS_VM.md`, phase 6).

## macOS

### What is needed — the product owner's decision

- An **Apple Developer Program** membership, and a **Developer ID
  Application** certificate exported as a `.p12` with a password.
- **Whether to notarize.** A signed but unnotarized app still meets
  Gatekeeper on first launch when it carries the quarantine flag.
  Notarization is what removes that prompt. It needs an App Store Connect API
  key (issuer id, key id and the `.p8` file), or an Apple ID with an
  app-specific password and the team id.

### Configuring Tauri

Tauri 2 reads these from the environment during `tauri build`. Set them from
secrets on the macOS CI job, or in the shell of the Mac that builds:

| Variable | What |
|---|---|
| `APPLE_CERTIFICATE` | the `.p12`, base64-encoded |
| `APPLE_CERTIFICATE_PASSWORD` | its password |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: <name> (<team id>)` |
| `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH` | for notarization with an API key |
| — or — `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` | for notarization with an Apple ID |

Build as now: `npm run tauri build -- --target universal-apple-darwin`.

### Proving it

```sh
APP="Teacher Planner.app"
codesign --verify --deep --strict --verbose=2 "$APP"   # must pass
codesign -dv --verbose=4 "$APP" 2>&1 | grep -E "Authority|TeamIdentifier|Runtime"
spctl -a -vv -t exec "$APP"                             # "accepted", source=Notarized Developer ID
xcrun stapler validate "$APP"                           # if notarized
lipo -archs "$APP/Contents/MacOS/teacher-planner"       # still x86_64 arm64
```

Then a person, on a Mac that has never run this build: give the app the
quarantine flag the way a download would (or download it), put it in a synced
folder, **double-click it**, and record whether Gatekeeper asks anything.

### One check specific to this app

The app lives **inside a Google Drive or OneDrive folder**, and a sync client
copies the bundle file by file. After signing, copy the signed `.app` into a
synced folder on device 1, let it sync to device 2, and run the `codesign
--verify --deep --strict` and `spctl` commands above **on device 2's copy**. A
sync client that rewrote any file inside the bundle would break the seal. That
has not been tested, because no signed build has existed yet.

## The installer and the .dmg

The app keeps `data/` and `exports/` **beside its own executable** (`src-tauri/
src/paths.rs`). That is what makes the synced folder the teacher's agenda. The
NSIS installer puts the app in `%LOCALAPPDATA%\Teacher Planner`, and a `.dmg`
invites dragging it into `/Applications`. **From either place, the data would
be created outside the synced folder**, on that one computer. The teacher-facing
guide therefore tells her to run the `.exe` and the `.app` from the synced
folder, and not to use the installer or the `.dmg`. Signing does not change
that, and it is why the files she double-clicks are the ones that have to be
signed.
