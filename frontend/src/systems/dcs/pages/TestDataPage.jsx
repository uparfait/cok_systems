import React from "react";
import { useOutletContext } from "react-router-dom";
import DcsTestDataManager from "../components/DcsTestDataManager.jsx";

export default function TestDataPage() {
  const { form_group_id, form, refreshForm } = useOutletContext();

  return (
    <div className="space-y-4 pb-16">
      <DcsTestDataManager formGroupId={form_group_id} form={form} refreshForm={refreshForm} />
    </div>
  );
}
