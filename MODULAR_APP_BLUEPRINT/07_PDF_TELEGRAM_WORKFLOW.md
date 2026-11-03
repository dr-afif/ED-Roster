# Roster PDF Archive and Private Telegram Delivery

## User experience

The roster page exposes three separate actions:

1. **Preview PDF** — no external write.
2. **Archive snapshot to Drive** — creates an immutable audit copy.
3. **Send to My Telegram** — enabled only for a successfully archived snapshot.

Telegram is a personal transfer inbox for the owner. The owner can then share the downloaded PDF through WhatsApp or another phone app.

## Snapshot state machine

```text
requested → snapshot_created → rendering → uploading_drive → archived
                                      ↘ render_failed
                                                        ↘ drive_failed

archived → telegram_sending → telegram_sent
                         ↘ telegram_failed → retry
```

Drive archive success is never rolled back because Telegram fails.

## Archive command

### Database transaction

An owner-authorized command:

- checks period state and expected revision;
- rejects empty/unmapped/corrupt canonical data;
- prevents duplicate snapshot for the same period/revision;
- increments the per-period snapshot version;
- freezes canonical JSON and its SHA-256;
- records type, reason, predecessor and actor;
- commits status `snapshot_created`.

### PDF rendering

After commit, the function renders from the frozen canonical payload, never from mutable UI state. Use a deterministic server-compatible PDF library chosen through an implementation spike; `pdf-lib` is the initial candidate. Do not depend on a full browser/Chromium inside an Edge Function without a proven runtime plan.

PDF contents:

- department and roster period;
- snapshot version and type;
- lifecycle/source revision;
- current roster grid or clearly labeled planned/current variant;
- date/day headers and public holidays;
- shift legend;
- publication/archive actor and timestamps in Asia/Kuala_Lumpur;
- amendment reason and predecessor version where applicable;
- short change summary for amended snapshots;
- snapshot ID and abbreviated payload/PDF hashes;
- page number and confidentiality footer.

Layout target is landscape with repeatable headers and readable minimum text. If one page would become unreadable, paginate by staff blocks; never shrink below the approved minimum.

### Drive upload

Upload to:

```text
02 - Rosters/<year>/<month>/
```

Filename examples:

```text
ED_Roster_2027-01_v01_Initial.pdf
ED_Roster_2027-01_v02_Amendment_2027-01-08.pdf
```

Never overwrite an earlier PDF. Store Drive file ID, folder ID, PDF SHA-256 and archived time.

## Telegram setup

1. Owner creates a bot through BotFather.
2. Owner opens the bot and sends `/start`; bots cannot initiate a private conversation before this interaction.
3. Record the resulting private chat ID during a controlled setup/test.
4. Store `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OWNER_CHAT_ID` as server-side function secrets.
5. Run a test send using a non-sensitive PDF.

No Telegram account mapping, group/channel management, commands, webhook receiver or staff subscription table is required.

## Telegram send command

1. Verify signed-in owner and archived snapshot.
2. Insert/reuse a delivery operation with idempotency key.
3. Download the exact Drive file using the stored file ID and server credential.
4. Call Telegram [`sendDocument`](https://core.telegram.org/bots/api#senddocument) with multipart file bytes and caption.
5. Store returned `message_id`, chat ID, sent time and actor.
6. Return a success state to the app.

Recommended caption:

```text
ED Roster — January 2027
Snapshot v02 — Amendment
Supersedes v01
Archived 8 Jan 2027, 14:35 MYT
```

Set Telegram `protect_content` to false because the intended purpose is to save/forward the PDF from the owner's phone.

## Delivery privacy

Only the owner's fixed chat ID is permitted. The client cannot supply an arbitrary destination. A PDF sent to Telegram can be retained, downloaded, screenshotted or forwarded outside Drive/Supabase controls; the app must show a brief confirmation before sending.

## Retry and duplicate behavior

- Normal send has one active delivery per snapshot/channel.
- Repeated clicks while sending are disabled.
- A timeout with unknown outcome is reconciled against stored result where possible; do not immediately send twice.
- **Retry** reuses the failed logical delivery/idempotency key until a confirmed Telegram message exists.
- **Resend intentionally** creates a new delivery record linked to the earlier delivery and requires confirmation.
- Telegram failure never creates another Drive snapshot.

## Acceptance cases

- Preview does not create a snapshot or upload.
- Archive of an unchanged revision returns the existing snapshot instead of duplicating it.
- Archive of a new amendment revision creates a new version and retains the old file.
- PDF hash and canonical payload hash are stored.
- Telegram action is unavailable before Drive status is archived.
- Telegram receives the exact archived bytes.
- Non-owner calls are denied.
- Browser bundle contains no bot token, chat ID credential or Google private key.
- Drive failure is retryable without duplicate snapshot/file.
- Telegram failure is retryable without duplicate Drive file.

