import Link from "next/link";
import { RecurLogoIcon } from "../components/icons/RecurLogoIcon";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-recur-base flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <RecurLogoIcon size={48} />
        </div>
        <h1 className="text-[64px] font-[900] font-mono text-recur-text-heading leading-none mb-2">
          404
        </h1>
        <h2 className="text-[18px] font-bold text-recur-text-heading mb-2">
          Page Not Found
        </h2>
        <p className="text-[13px] text-recur-text-muted mb-8">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-primary text-[13px] px-5 py-2.5">
            Go Home
          </Link>
          <Link href="/dashboard" className="btn-secondary text-[13px] px-5 py-2.5">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
