"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/providers/AuthProvider";
import { DashboardSidebar } from "../../components/dashboard/DashboardSidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-recur-base flex items-center justify-center">
        <div className="animate-pulse text-recur-text-muted text-[13px]">
          Redirecting...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-recur-base flex">
      <DashboardSidebar />
      <main className="flex-1 ml-0 lg:ml-[240px] min-h-screen">
        <div className="max-w-[1000px] mx-auto px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
