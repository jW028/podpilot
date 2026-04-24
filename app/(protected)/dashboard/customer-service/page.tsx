import DashboardHeader from "@/components/dashboard/DashboardHeader";
import CustomerServicePage from "@/components/ui/support/CustomerServicePage";

const DashboardCustomerService = () => {
  return (
    <>
      <DashboardHeader />
      <main>
        <CustomerServicePage businessId="dashboard" />
      </main>
    </>
  );
};

export default DashboardCustomerService;
