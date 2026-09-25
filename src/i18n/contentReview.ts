/**
 * Whether the English *content* has been reviewed, and so may be shown (M10).
 *
 * "Content" is the product's own text rather than the app's labels: the seven
 * parent letters (`lettersEn.ts`), the 150-message bank with its categories
 * and placeholder names (`messagesEn.ts`), and the forms' fixed text — the
 * period checklist's items and the substitute folder's suggested boxes
 * (`formsEn.ts`). M9 wrote all three as a machine-translated draft that no
 * person who reads both languages has checked, and they go to parents.
 *
 * **The product owner's call at M10 (2026-09-25): until someone has reviewed
 * them, that content stays Greek in the English interface.** The interface
 * itself — every label, button and caption in `en.ts` — is still English. A
 * letter or a message is printed wholly in Greek, footer included, because it
 * is a document for a Greek-speaking parent rather than a screen.
 *
 * Nothing is deleted: the three English files stay in the build, are still
 * held key for key and placeholder for placeholder against the Greek by
 * `tests/unit/i18nParity.test.ts`, and are what `tests/component/Bilingual`
 * exercises with this switched on. **Turning it on is this one line**, once a
 * bilingual reader's corrections are in those files — and the "unreviewed"
 * warnings at the top of them come out for what was actually reviewed.
 */
export const ENGLISH_CONTENT_REVIEWED: boolean = false;
