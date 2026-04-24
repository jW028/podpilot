import React from "react";
import DashboardPageContent from "./DashboardPageContent";

interface DashboardPageProps {
  activeCount?: number;
}

const DashboardPage = ({ activeCount }: DashboardPageProps) => {
  return <DashboardPageContent activeCount={activeCount} />;
};

export default DashboardPage;
