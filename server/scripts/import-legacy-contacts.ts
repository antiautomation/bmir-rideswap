/* Import the v1 (Firestore) ride-board contacts into invite_contacts.
   Safe to re-run: existing rows keep their unsubscribe token, unsubscribe state,
   and any manual exclusion; the derived v1 facts get refreshed.

   Run: npm run import:contacts -w server -- --dry-run   (needs DATABASE_URL)
        npm run import:contacts -w server                (commit)
        npm run import:contacts -w server -- --file dump.json

   The same import is available from the admin console (Invites tab), which is
   the normal path. This script exists for when you want it from a shell. */
import { pool } from '../src/db/client.js';
import { importLegacyContacts } from '../src/lib/legacyImport.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const fileIdx = argv.indexOf('--file');
  const file = fileIdx >= 0 ? argv[fileIdx + 1] : undefined;

  const result = await importLegacyContacts({ dryRun, file });

  console.log('--- v1 contact import ---');
  console.log(`mode:              ${dryRun ? 'DRY RUN (nothing written)' : 'COMMIT'}`);
  console.log(`source:            ${file ?? 'firestore REST (bmir-rideshare)'}`);
  console.log(`docs scanned:      ${result.docsScanned} (${result.driverDocs} driver, ${result.riderDocs} rider)`);
  console.log(`soft-deleted docs: ${result.softDeletedDocs}`);
  console.log(`no email:          ${result.docsWithoutEmail}`);
  console.log(`malformed email:   ${result.docsWithMalformedEmail}`);
  console.log(`unique contacts:   ${result.uniqueContacts}`);
  console.log(
    `  segments:        driver=${result.segments.driver} rider=${result.segments.rider} both=${result.segments.both}`,
  );
  console.log(`auto-excluded:     ${result.excluded.total} ${JSON.stringify(result.excluded.byReason)}`);
  console.log(`contacts inserted: ${result.inserted}`);
  console.log(`contacts updated:  ${result.updated}`);
  console.log(`added to list:     ${result.addedToList} ("${result.listName}")`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
