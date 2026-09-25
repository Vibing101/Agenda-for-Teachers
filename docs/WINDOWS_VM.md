# A Windows VM for gate step 5

Gate step 5 — *launch the packaged app by double-click from inside a real
cloud-synced folder* — is the one step that killed the previous attempt and the
one CI cannot do. Until now it has needed a borrowed physical machine, which is
why M0 shipped without it and M1 shipped with half of it.

A Windows 11 VM on the development Mac closes most of that gap permanently. This
document is the setup, once, plus what it does and does not buy.

Written against the machine this project is developed on: **Intel Core i7-9750H,
32 GB RAM, 12 logical cores, macOS 26**. The Intel part matters — see below.

---

## Which machine am I on?

There are three places work on this project can happen, and they can do
different things. **An agent's first job is to work out which one it is on**,
because claiming a gate step from the wrong machine is exactly the failure this
project keeps guarding against.

On macOS:

```sh
uname -s                                            # Darwin
VBoxManage list vms | grep MilestoneTesting         # present => this is the dev Mac
ssh -p 2222 -o BatchMode=yes vboxtester@127.0.0.1 "hostname"
```

On Windows, in PowerShell:

```powershell
$env:COMPUTERNAME        # MILESTONETESTIN => you are inside the test VM
```

| Where | How you know | What it can do |
|---|---|---|
| **The dev Mac** | `uname -s` is `Darwin` and `VBoxManage list vms` lists `MilestoneTesting` | Everything on macOS, plus **drive the Windows VM over SSH** for the Windows half of the gate. This is the normal place to work |
| **Inside the test VM** | `$env:COMPUTERNAME` is `MILESTONETESTIN` | The full gate natively on Windows, packaged builds, and the file-level cloud-folder checks. No repo credentials — see below |
| **The separate physical Windows PC** | Windows, but a different `COMPUTERNAME` | Hand-testing with a human present. As of the M1 gate it had VS Code and Node but **no Rust toolchain or MSVC Build Tools**, so it could not build or package — check before assuming |

If none of these match, you are somewhere new: say so rather than guessing, and
do not claim gate step 4 or 5 from it.

---

## Connection details, verified 2026-09-24

**The guest was reinstalled from scratch on 2026-09-24**, during M8: its virtual
disk was corrupted after a Windows Update at M7, and sshd never answered again.
Everything below is the reinstalled machine. **The user changed** from
`vboxtester` to `kyria`; commands elsewhere in this file that say `vboxtester`
mean whichever user the table names.

| | |
|---|---|
| From the Mac | `ssh -p 2222 kyria@127.0.0.1` |
| Auth | The Mac's `~/.ssh/id_ed25519`, installed as `administrators_authorized_keys` |
| Remote shell | Windows PowerShell 5.1 |
| Guest | Windows 11 Pro, x64 |
| Repo in the guest | `C:\Dev\Agenda-for-Teachers`, cloned fresh from a bundle at M9 (branch `m9-bilingual-polish`); M8's clone kept aside as `C:\Dev\Agenda-for-Teachers-m8` |
| Toolchain | VS 2022 Build Tools (C++), Git 2.55, Node 24.19, Rust 1.98.1, all by `winget` over SSH |
| Sync clients | OneDrive and Google Drive both signed in and running |
| Snapshot | `clean-baseline`, taken live at M8 after the toolchain and before the app ever ran |

**Taking a live snapshot left the VM `paused due to host power management`**, and
`controlvm resume` refused. `controlvm savestate` then **failed and left the VM
`aborted`**, which is a hard power-off. It came back clean (`Repair-Volume -Scan`
found no errors, `git fsck` was clean), but that is luck, not a procedure, on a
machine whose last disk was corrupted. **Run `caffeinate -dimsu` on the Mac
before taking a snapshot**, not only before a gate run.

**The VM deliberately holds no GitHub credentials.** It is a machine that gets
snapshotted and reverted, and a snapshot would carry any stored token or deploy
key with it. Code is moved in as a git bundle instead:

```sh
# on the Mac, for whatever branch is under test
git bundle create /tmp/agenda.bundle --branches --tags
scp -P 2222 /tmp/agenda.bundle vboxtester@127.0.0.1:C:/Dev/agenda.bundle

# first time only, in the guest
git clone -b main C:\Dev\agenda.bundle Agenda-for-Teachers
# afterwards
git -C C:\Dev\Agenda-for-Teachers pull C:\Dev\agenda.bundle <branch>
```

A note from the M2 gate, since it costs a round trip to rediscover: **fetching a
branch into itself while it is checked out is refused** (`fatal: refusing to
fetch into branch 'refs/heads/<branch>' checked out at ...`), and git says so on
stderr, which over SSH is easy to read past. Fetch and reset instead:

```powershell
git fetch C:\Dev\agenda.bundle <branch>   # lands in FETCH_HEAD
git reset --hard FETCH_HEAD
git log --oneline -1                      # always confirm which commit is being tested
```

Around 7 MB, no credentials, and it survives the snapshot-revert workflow. If a
normal `git pull` is ever wanted in there, a **read-only deploy key** scoped to
this repo is the way, and that is a product-owner decision because it changes
GitHub settings.

---

## Why a VM is a fair target here, on this Mac

This Mac is **Intel x86-64**, so a Windows 11 x64 guest runs the same
instruction set the app is actually built for. A test there is a real test.

On an Apple Silicon Mac it would not be: you can only virtualise **Windows 11 on
ARM**, which runs an x64 binary through emulation. Every failure would carry an
asterisk — *is this the app, or the emulator?* — and for the specific failure
class this project is guarding against (file I/O against a sync client's
placeholder files) that asterisk would make the result close to worthless. If
this project ever moves to an Apple Silicon Mac, the physical-machine
requirement comes back.

---

## Phase 1 — hypervisor

**VMware Fusion** is the recommendation: free for personal use, supports Intel
Macs, and provides the virtual TPM 2.0 that Windows 11 requires. Download needs
a free Broadcom account, which is the only irritating part.

**VirtualBox 7** is a workable free alternative — it added TPM 2.0 and Secure
Boot, which is what Windows 11 setup checks for. Its guest performance is a
notch below Fusion's for this kind of work. **This is what the project's VM
actually runs on**, and it has been fine; the commands in phase 3a are written
for it.

**Parallels Desktop** is the smoothest experience and is a paid subscription.
Nothing here needs it.

Avoid UTM/QEMU on this machine: it works, but you will spend the time you saved
on tuning.

## Phase 2 — Windows 11 guest

Microsoft publishes the Windows 11 ISO for direct download at
`microsoft.com/software-download/windows11`. No licence key is required to
install. Unactivated Windows runs indefinitely with a desktop watermark and
locked personalisation settings — neither affects anything tested here.
Activation is a licensing decision for the product owner, not a technical one.

Allocate, from this Mac's 32 GB / 12 cores:

| Resource | Give it | Why |
|---|---|---|
| RAM | 8 GB | Comfortable for the build; leaves 24 GB for macOS |
| CPU | 6 vCPU | Halves the ~18-minute release build; leaves 6 for the host |
| Disk | 120 GB, thin-provisioned | Windows ~30, VS Build Tools ~10, Rust ~2, repo + `target` ~8. Only what is used is consumed on the Mac |
| TPM | Enabled | Windows 11 setup refuses without it |

During Windows setup, create a **local account** rather than a Microsoft one
where the installer allows it — it keeps OneDrive's state under your control
rather than auto-configured, which matters for the placeholder tests below.

## Phase 3 — let the Mac drive it

This is the step that turns the VM from "a machine you use" into "a machine the
agent uses". It is also the step that goes wrong, so this section records what
actually worked on 2026-09-20 rather than what the documentation suggests.

### 3a. Port forwarding (VirtualBox NAT)

VirtualBox's default NAT adapter gives the guest internet but leaves it
unreachable from the Mac. Add a loopback-only forward — this can be done from
the Mac, and works on a running VM:

```sh
VBoxManage controlvm <vm-name> natpf1 "ssh,tcp,127.0.0.1,2222,,22"
VBoxManage showvminfo <vm-name> --machinereadable | grep -i forwarding
```

Binding to `127.0.0.1` keeps the guest's SSH off the LAN. With the VM powered
off, use `modifyvm --natpf1` with the same argument. Bridged networking is the
alternative and needs no forward, but then the guest is on the LAN and its
address moves with DHCP.

### 3b. Installing sshd — use the zip, not the optional feature

**Do not use `Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0`.**
It is the documented route and it failed twice on this VM. It pulls from
Windows Update's Features-on-Demand, and in a fresh Windows 11 guest it hangs
mid-progress-bar for 10–15 minutes with the Windows Update service running and
internet confirmed working. Worse than failing: it leaves the capability at
`InstallPending` and registers `ssh-agent` but **not** `sshd`, and that
half-state makes every subsequent repair attempt fail with a misleading
`Stop-Service : Cannot open sshd service` — including the zip installer, which
aborts on it because it sets `$ErrorActionPreference = "Stop"`.

If that has already happened, wipe it completely before trying anything else:

```powershell
foreach ($s in 'sshd','ssh-agent') {
  if (Get-Service $s -ErrorAction SilentlyContinue) { Stop-Service $s -Force -ErrorAction SilentlyContinue }
  sc.exe delete $s | Out-Null
}
Remove-Item 'C:\Program Files\OpenSSH' -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item 'C:\ProgramData\ssh'       -Recurse -Force -ErrorAction SilentlyContinue
Remove-NetFirewallRule -Name sshd -ErrorAction SilentlyContinue
Remove-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
```

Then reboot and confirm `Get-WindowsCapability -Online -Name OpenSSH.Server*`
reports `NotPresent` with no `sshd`/`ssh-agent` services. Only from that clean
state does the zip install work.

**The route that works.** Download `OpenSSH-Win64.zip` from the
[Win32-OpenSSH releases](https://github.com/PowerShell/Win32-OpenSSH/releases) —
the same binaries Microsoft ships as the optional feature, without the servicing
stack. In an Administrator PowerShell:

```powershell
$dst = 'C:\Program Files\OpenSSH'
Expand-Archive "$env:USERPROFILE\Downloads\OpenSSH-Win64.zip" -DestinationPath $dst -Force
$bin = Join-Path $dst 'OpenSSH-Win64'
Set-Location $bin

powershell -ExecutionPolicy Bypass -File .\install-sshd.ps1
Get-Service sshd, ssh-agent      # both must exist before going on

# The installer does not create this directory, and ssh-keygen will not either.
New-Item -ItemType Directory -Path 'C:\ProgramData\ssh' -Force | Out-Null
Copy-Item "$bin\sshd_config_default" 'C:\ProgramData\ssh\sshd_config' -Force
& "$bin\ssh-keygen.exe" -A

# Answer Y to every prompt. sshd refuses to start without this.
powershell -ExecutionPolicy Bypass -File .\FixHostFilePermissions.ps1

New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' `
  -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
Set-Service sshd -StartupType Automatic
Start-Service sshd
Get-Service sshd
```

Two traps in there, both of which produce unhelpful errors:

- **`C:\ProgramData\ssh` must exist first.** `ssh-keygen -A` does not create it
  and fails with `Could not save your private key in __PROGRAMDATA__\ssh/...:
  No such file or directory`.
- **`sshd_config` must be copied in.** Host keys alone are not enough; the
  service will not start without a config file.

### 3c. Key authentication

```powershell
if (-not (Test-Path 'HKLM:\SOFTWARE\OpenSSH')) { New-Item -Path 'HKLM:\SOFTWARE\OpenSSH' -Force | Out-Null }
New-ItemProperty -Path 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell `
  -Value 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' -PropertyType String -Force

$key = '<paste the contents of the Mac ~/.ssh/id_ed25519.pub here>'
$f   = 'C:\ProgramData\ssh\administrators_authorized_keys'
Set-Content -Path $f -Value $key -Encoding ascii
icacls $f /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"
Restart-Service sshd
```

Three things here are not optional:

- **`administrators_authorized_keys`, not `~/.ssh/authorized_keys`.** For an
  account in the Administrators group, Windows OpenSSH ignores the home-directory
  file entirely.
- **The `icacls` line.** sshd refuses the file unless only SYSTEM and
  Administrators have access.
- **`-Encoding ascii`.** PowerShell 5.1's `utf8` writes a byte-order mark; sshd
  rejects the file and logs nothing useful. The symptom is an unexplained
  `Permission denied (publickey,...)`.

Confirm from the Mac:

```sh
ssh -p 2222 -o BatchMode=yes <user>@127.0.0.1 "whoami; (Get-CimInstance Win32_OperatingSystem).Caption"
```

## Phase 4 — the toolchain

In the guest, so the full gate runs natively on Windows rather than only in CI:

1. **Visual Studio Build Tools** with the *Desktop development with C++*
   workload, including the Windows SDK. ~10 GB, and Rust's MSVC toolchain and
   Tauri both need it. Install this first.
2. **Rust** via `rustup-init.exe` — take the default `x86_64-pc-windows-msvc`.
3. **Node 22+** and **Git**.
4. **WebView2** is already present on Windows 11; nothing to do.
5. **Allow local scripts**, or `npm` fails over SSH with
   `npm.ps1 cannot be loaded because running scripts is disabled`:
   `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`

On this VM, 1–3 installed cleanly over SSH with `winget install --id <pkg>
--silent --accept-package-agreements --accept-source-agreements
--disable-interactivity`, using `Git.Git`, `OpenJS.NodeJS.LTS`,
`Rustlang.Rustup` and `Microsoft.VisualStudio.2022.BuildTools` (the last with
`--override '--quiet --wait --norestart --add
Microsoft.VisualStudio.Workload.VCTools --includeRecommended'`). Note that a
freshly installed tool is not on the SSH session's `PATH` until the next login,
so an agent should prepend it:
`$env:PATH = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')`

Clone the repo to **`C:\Dev\Agenda-for-Teachers`**. Not into a synced folder,
and not onto a VMware shared folder from the Mac — `cargo` against HGFS is slow
and occasionally strange. The VM builds from its own disk, from GitHub.

## Phase 5 — the cloud clients

Both are needed, because the M0 acceptance criterion names both and the OneDrive
result does not transfer to Drive.

- **OneDrive** ships with Windows; sign in.
- **Google Drive for desktop** from `google.com/drive/download`; sign in.

Two warnings worth reading before you sign in:

Signing the same accounts into the VM will start syncing **your real Drive and
OneDrive** into it. Use each client's selective-sync / streaming mode and pick a
single dedicated test folder, or you will pull gigabytes into the guest and back
out again.

The flip side is a genuine bonus: the VM and the Mac are now two devices on the
same synced folders, which is exactly the rig **M9's two-device release gate**
asks for — write on device 1, let sync settle, read on device 2.

## Phase 6 — snapshot discipline

**This is the part that is specific to this project, and the easiest to skip.**

Several of the things being tested are *first-run* behaviours that a machine
only exhibits once:

- SmartScreen remembers a *Run anyway* decision, so the second double-click of a
  given build never shows the dialog.
- The first launch in a folder is the one that creates `data/`, and the second is
  the one that must write a backup snapshot.
- A hydrated placeholder stays hydrated.

So: finish phases 1–5, then take a snapshot named **`clean-baseline`** before
ever running the app. Revert to it before each milestone's gate step 5. A result
from a machine that has already trusted a previous build is not the result the
teacher will get.

Keep a second snapshot, `toolchain-only`, after phase 4 but before phase 5, for
when you want to test build behaviour without the sync clients running.

---

## What this buys, and what it does not

Being precise about this matters, because the whole point of gate step 5 is that
it is the step nobody is allowed to quietly claim.

### The agent can now do these over SSH

- The full gate natively on Windows: `typecheck`, `lint`, `npm test`,
  `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`
- `npm run tauri build` — a real Windows `.exe` and NSIS installer, so a fix no
  longer has to wait for CI to be packaged
- Launch the app, confirm it stays open, and verify `data/planner.sqlite`
  appears beside it with the expected `user_version` and tables
- Quit, relaunch, and confirm data survives and a dated snapshot was written
- Confirm no `-wal` / `-shm` sidecars are ever left behind
- Hash the database before and after an operation to prove nothing was lost
- Drive the **online-only placeholder** case end to end: force files
  offline (`attrib -P +U <file>`), verify they are genuinely dehydrated
  (`Offline`, `RecallOnDataAccess`, zero bytes on disk against full logical
  size), then launch and confirm hydration, no hang, and no data loss
- Inspect `Zone.Identifier` streams — including confirming the NSIS installer
  does not propagate Mark of the Web to the exe it extracts

That is most of what the borrowed machine did at M1, now repeatable on demand.

### Three things that cost a round trip to rediscover (found at the M3 gate)

- **Keep the Mac awake for the whole run.** macOS power management *pauses* the
  VM — `VBoxManage showvminfo` reports `VMState="paused"` and "paused due to host
  power management", SSH times out during banner exchange, and a check running at
  that moment returns nonsense. At the M3 gate this caught a database
  mid-migration and made it look torn when it was not. Run `caffeinate -dimsu`
  on the Mac for the duration, and if SSH dies mid-run, check the VM's state
  before believing any result around it.
- **Never put Greek in an SSH command line.** The console code page mangles it,
  so `schtasks`, paths and comparisons silently operate on the wrong string.
  Write a `.ps1` file, `scp` it in, and run it with
  `powershell -ExecutionPolicy Bypass -File`. Build Greek names inside the script
  from code points (`[char]0x0391 + …`) rather than pasting literals.
- **Greek in a local `grep` pattern can silently match nothing** under this
  shell, which makes a process list look empty and a "clean quit" look done when
  the app is still running. Match on ASCII (`OneDrive`, `GoogleDrive`,
  `Contents/MacOS/teacher-planner`) and verify a quit by PID before trusting it.

Two more, specific to what the checks measure:

- **A sync client evicts asynchronously.** `attrib -P +U` marks a file unpinned
  immediately but the bytes can still be on disk seconds later. Poll
  `GetCompressedFileSizeW` until it reads 0 before claiming a file is genuinely
  dehydrated.
- **Do not test "is this table gone?" by scanning the database's bytes.** SQLite
  leaves a dropped table's `CREATE TABLE` text in freed pages, so a raw scan
  reports it as still present. Query `sqlite_master` — there is no `sqlite3` in
  the guest, so copy the file back to the Mac and inspect it there.

### Still needs a human at the VM's screen

- **A genuine Explorer double-click, and therefore SmartScreen.** Established at
  the M1 gate: `Start-Process` and `Shell.InvokeVerb("open")` both launch a
  Mark-of-the-Web-tagged unsigned build cleanly with no dialog. Only a real
  double-click in Explorer is blocked. No amount of scripting reproduces it, and
  that is exactly why the CI tripwire was retired.
- **Typing into the app and looking at it.** Layout, clipping, and whether
  anything is untranslated. The `Νέο τμήμα` data-loss bug at M1 was found this
  way and by nothing else.

### What worked at M9: eyes and hands in the console session

M9 needed the app to render on Windows (92 PDFs, the two-device test, the
disk-changed demo), so it built small helpers in `C:\Dev\m9vm\`. The pattern:
a one-shot scheduled task, `/ru kyria /it`, pointing at a `.cmd` wrapper (paths
with spaces on `G:` fail as a direct `/tr`). With it an agent can:

- **launch the exe** in session 1, so WebView2 has a desktop and the app really
  loads;
- **close it cleanly** with `CloseMainWindow()` — which must also run in the
  console session, since another session sees no window handle;
- **take a screenshot** (`System.Drawing` `CopyFromScreen`) and `scp` it back;
- **press a button**: UI Automation finds it by name, but its `Invoke` does
  **not** fire the page's click handler in WebView2 — the click has to be a real
  `mouse_event` at the element's bounding rectangle. Put a Greek button name in
  a UTF-8 file, never on the command line.

**The guest's clock drifts.** At M9 it was 1 h 43 m slow in the right time zone
(and corrected itself later), so its backups were named in the past. Check
`Get-Date` against the Mac before reading anything into timestamps.

### M10 (2026-09-25): sshd gone from the guest

At M10's start, SSH timed out during the banner exchange with the VM running and
its desktop up. An ACPI power-button press was ignored; a restart was typed into
*Run* through `VBoxManage controlvm MilestoneTesting keyboardputscancode` /
`keyboardputstring` (Win+R is `e0 5b 13 93 e0 db`, Enter is `1c 9c`). At the
console, `Get-Service sshd` then reported **no such service** — only
`ssh-agent` registered, the half-state §3b describes — and the product owner
found the guest's folders in no state to reinstall from. **M10's Windows half
was not run.** The next agent should expect to either rebuild OpenSSH by §3b
(wipe first) or revert to `clean-baseline`, which discards everything done in
the guest since M8.

### Optional: give the agent eyes

A scheduled task running **as the logged-in user** can capture the interactive
desktop and drop a PNG somewhere the agent can `scp` back. It is fiddly — a task
run over SSH lands in a non-interactive session and captures a black screen
unless it is scheduled into the console session — but it works, and it would let
UI rendering be checked without a person watching. Worth setting up if the
manual UI pass becomes the bottleneck. It still does not solve SmartScreen.

---

## Per-milestone routine, once this exists

1. Revert the VM to `clean-baseline`.
2. Agent, over SSH: pull the branch, run the full gate, build the installer.
3. Agent: run the file-level cloud-folder checks from both a Drive and a
   OneDrive folder, including the placeholder case.
4. Human, at the VM: install from the built installer, double-click it from a
   synced folder, note what SmartScreen does, and spend five minutes typing real
   data into the milestone's new screens.
5. Agent: record all of it in the milestone's release note, marking clearly
   which results came from the agent and which from the human.
