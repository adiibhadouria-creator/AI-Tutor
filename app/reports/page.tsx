import { Sidebar } from "@/components/chat/Sidebar";
import { ReportsList } from "@/components/reports/ReportsList";

export default function ReportsPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-3xl font-bold text-foreground">Reports</h1>
          <ReportsList />
        </div>
      </main>
    </div>
  );
}
