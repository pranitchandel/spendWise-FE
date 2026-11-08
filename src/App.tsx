import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import { AuthPage } from '@/pages/auth/AuthPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { AccountsPage } from '@/pages/accounts/AccountsPage'
import { BudgetsPage } from '@/pages/budgets/BudgetsPage'
import { LendingBorrowingPage } from '@/pages/lending/LendingBorrowingPage'
import { SettingsPage } from '@/pages/settings/SettingsPage'
import { StatisticsPage } from '@/pages/StatisticsPage'
import { RecurringPage } from '@/pages/recurring/RecurringPage'
import { TransactionsPage } from '@/pages/transactions/TransactionsPage'
import { CategoriesPage } from '@/pages/settings/CategoriesPage'
import { PlannedExpensesPage } from '@/pages/planned-expenses/PlannedExpensesPage'
import { SavingsPage } from '@/pages/savings/SavingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="transactions/new" element={<Navigate to="/transactions?add=1" replace />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="lending" element={<LendingBorrowingPage />} />
          <Route path="borrowing" element={<LendingBorrowingPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/categories" element={<CategoriesPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="planned-expenses" element={<PlannedExpensesPage />} />
          <Route path="savings" element={<SavingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
