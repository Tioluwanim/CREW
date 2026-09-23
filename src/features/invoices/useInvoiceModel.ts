'use client';

import { useProjectStore } from '../../store/projectStore';

export function useInvoiceModel() {
  const project = useProjectStore((state) => state.project);
  const invoiceApproved = useProjectStore((state) => state.invoiceApproved);
  const approveInvoice = useProjectStore((state) => state.approveInvoice);
  const derived = useProjectStore((state) => state.derived)();
  return { project, invoiceApproved, approveInvoice, derived };
}