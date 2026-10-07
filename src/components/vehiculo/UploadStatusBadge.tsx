export default function UploadStatusBadge({ label = "Procesando foto..." }: { label?: string }) {
  return (
    <span className="badge mt-1 inline-flex items-center gap-1 bg-dorado-100 text-tierra-700">
      <span className="h-2 w-2 animate-pulse rounded-full bg-dorado-500" />
      {label}
    </span>
  );
}
