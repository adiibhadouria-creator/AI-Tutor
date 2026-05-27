import { Sidebar } from "@/components/chat/Sidebar";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function DashboardPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-bold text-foreground">Dashboard</h1>
          <DashboardView />
        </div>
      </main>
    </div>
  );
}
