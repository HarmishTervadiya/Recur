import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-sm">
        <p
          className="text-[48px] font-[900] font-mono text-recur-text-heading leading-none mb-2"
          aria-hidden="true"
        >
          404
        </p>
        <h1 className="text-[15px] font-bold text-recur-text-heading mb-2">
          Page Not Found
        </h1>
        <p className="text-[13px] text-recur-text-muted mb-6">
          This dashboard page does not exist.
        </p>
        <Link href="/dashboard" className="btn-primary text-[13px] px-5 py-2">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
