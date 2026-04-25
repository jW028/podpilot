import DashboardPage from "@/components/dashboard/DashboardPage";
import { getServerSupabase } from "@/lib/supabase/server";

const Dashboard = async () => {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let activeCount = 0;
  if (user) {
    const { count } = await supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    activeCount = count || 0;
  }

  return <DashboardPage activeCount={activeCount} />;
};

export default Dashboard;
