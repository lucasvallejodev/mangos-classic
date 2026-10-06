import { ImportWizard } from "@/components/import-wizard";

export default function ImportPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Import a character</h1>
      <p className="text-sm text-gray-400">
        Upload a file exported from the character list. The character is created as a new one under the account you
        choose; nothing existing is overwritten. The world server must be stopped while importing.
      </p>
      <ImportWizard />
    </div>
  );
}
