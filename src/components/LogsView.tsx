import React, { useState } from "react";
import { LoggedSession, Expense, DeviceType } from "../types";
import { 
  History, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  FileText, 
  DollarSign, 
  User, 
  Clock, 
  Users, 
  Search, 
  Filter, 
  ChevronDown, 
  ArrowLeftRight, 
  ArrowDownCircle, 
  ArrowUpCircle,
  Package,
  Monitor,
  Gamepad,
  X
} from "lucide-react";
import { formatCurrency } from "../utils/calculations";

interface LogsViewProps {
  logs: LoggedSession[];
  expenses: Expense[];
  shiftDate: string;
}

type FilterPeriod = "today" | "week" | "month" | "custom";

export default function LogsView({ logs, expenses, shiftDate }: LogsViewProps) {
  const [period, setPeriod] = useState<FilterPeriod>("today");
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>(shiftDate);
  const [searchTerm, setSearchTerm] = useState("");

  // Helper to check if a date string/timestamp is within the range
  const getPeriodStartTimestamp = (periodType: FilterPeriod): number => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // start of today

    if (periodType === "today") {
      return now.getTime();
    }
    if (periodType === "week") {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - 7);
      return startOfWeek.getTime();
    }
    if (periodType === "month") {
      const startOfMonth = new Date(now);
      startOfMonth.setMonth(now.getMonth() - 1);
      return startOfMonth.getTime();
    }
    return 0; // custom is handled separately
  };

  // Helper to match shiftDate or custom calendar dates
  const isDateMatch = (logShiftDate: string, logTimestamp: number): boolean => {
    if (period === "custom") {
      return logShiftDate === selectedCustomDate;
    }
    
    // For today/week/month, we check the shiftDate of logs
    // Today's shift date matches active shiftDate
    if (period === "today") {
      return logShiftDate === shiftDate;
    }

    // For week/month, we can compare timestamps
    const startMs = getPeriodStartTimestamp(period);
    return logTimestamp >= startMs;
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesPeriod = isDateMatch(log.shiftDate, log.endTime);
    const matchesSearch = log.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPeriod && matchesSearch;
  });

  // Filter expenses
  const filteredExpenses = expenses.filter(exp => {
    return isDateMatch(exp.date, exp.timestamp);
  });

  // Calculations for filtered statistics
  const totalPlayEarnings = filteredLogs.reduce((sum, log) => sum + log.playCost, 0);
  const totalProductEarnings = filteredLogs.reduce((sum, log) => sum + log.productsCost, 0);
  const totalShiftExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netShiftCollected = totalPlayEarnings + totalProductEarnings - totalShiftExpenses;

  // Selected details modal state
  const [selectedSessionLog, setSelectedSessionLog] = useState<LoggedSession | null>(null);

  return (
    <div className="space-y-6" id="logs-view-container">
      {/* Filters and Header Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            سجل العمليات المكتملة
          </h2>
          <p className="text-xs text-gray-500 mt-1">راجع كافة التفاصيل المالية للجلسات والمبيعات والمصروفات</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5" dir="rtl">
          {[
            { id: "today", label: "اليوم" },
            { id: "week", label: "الـ 7 أيام الماضية" },
            { id: "month", label: "الشهر الحالي" },
            { id: "custom", label: "تاريخ محدد" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as FilterPeriod)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
                period === p.id
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              {p.label}
            </button>
          ))}

          {period === "custom" && (
            <input
              type="date"
              value={selectedCustomDate}
              onChange={(e) => setSelectedCustomDate(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 focus:border-indigo-500 rounded-xl text-xs outline-hidden font-mono text-gray-700 bg-white"
            />
          )}
        </div>
      </div>

      {/* Mini Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4" dir="rtl">
        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 block font-bold">إيراد ألعاب البلايستيشن والـ ل.س</span>
            <span className="font-mono text-base font-bold text-indigo-700">{formatCurrency(totalPlayEarnings)}</span>
          </div>
          <span className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 block font-bold">إيراد مبيعات المنتجات</span>
            <span className="font-mono text-base font-bold text-emerald-700">{formatCurrency(totalProductEarnings)}</span>
          </div>
          <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 block font-bold">إجمالي المصروفات والمشتريات</span>
            <span className="font-mono text-base font-bold text-rose-700">{formatCurrency(totalShiftExpenses)}</span>
          </div>
          <span className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <ArrowDownCircle className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-gray-900 text-white p-4 rounded-xl border border-gray-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 block font-bold">صافي الدخل المالي</span>
            <span className="font-mono text-base font-bold text-amber-400">{formatCurrency(netShiftCollected)}</span>
          </div>
          <span className="p-2.5 bg-white/5 text-amber-400 rounded-xl">
            <TrendingUp className="w-5 h-5" />
          </span>
        </div>
      </div>

      {/* Main logs content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" dir="rtl">
        {/* Sessions table column */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-50">
            <div>
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-gray-500" />
                تفاصيل جلسات اللعب ({filteredLogs.length})
              </h3>
              <p className="text-[11px] text-gray-400">انقر على أي جلسة لعرض تفاصيل الفترات والمنتجات</p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="ابحث بالزبون أو الجهاز ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl pr-9 pl-3 py-1.5 text-xs text-gray-800 outline-hidden font-sans w-52"
              />
            </div>
          </div>

          {filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right">
                <thead className="bg-gray-50 text-gray-600 font-bold">
                  <tr>
                    <th className="p-3">الجهاز</th>
                    <th className="p-3">اسم الزبون</th>
                    <th className="p-3 text-center">المدة الملعوبة</th>
                    <th className="p-3 text-center">تكلفة اللعب</th>
                    <th className="p-3 text-center">المنتجات</th>
                    <th className="p-3 text-center">الصافي المدفوع</th>
                    <th className="p-3 text-center">التاريخ والوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.map((log) => {
                    const totalDue = log.playCost + log.productsCost;
                    return (
                      <tr 
                        key={log.id} 
                        onClick={() => setSelectedSessionLog(log)}
                        className="hover:bg-indigo-50/40 transition-colors cursor-pointer"
                      >
                        <td className="p-3 font-semibold text-gray-900 flex items-center gap-1">
                          {log.deviceType === DeviceType.PLAYSTATION ? (
                            <Gamepad className="w-3.5 h-3.5 text-indigo-500" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-indigo-500" />
                          )}
                          {log.deviceName}
                        </td>
                        <td className="p-3 text-gray-600 font-medium">{log.customerName}</td>
                        <td className="p-3 text-center font-mono font-medium text-gray-700">
                          {Math.round(log.totalDurationMinutes)} دقيقة
                        </td>
                        <td className="p-3 text-center font-mono text-gray-800">
                          {formatCurrency(log.playCost)}
                          {log.isPlayPrepaid && (
                            <span className="block text-[9px] text-emerald-600 font-bold font-sans">دفع مسبق</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono text-gray-800">
                          {formatCurrency(log.productsCost)}
                          {log.products.length > 0 && (
                            <span className="block text-[9px] text-gray-400 font-sans">({log.products.reduce((sum, p) => sum + p.quantity, 0)} قطع)</span>
                          )}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-700">
                          {formatCurrency(totalDue)}
                        </td>
                        <td className="p-3 text-center text-gray-400 font-mono text-[10px]">
                          <div className="leading-tight">{new Date(log.endTime).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" })}</div>
                          <div className="text-[8px] mt-0.5">{log.shiftDate}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-400 text-xs py-10">لا توجد سجلات جلسات مطابقة للفترة المحددة.</p>
          )}
        </div>

        {/* Expenses Column */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-50 pb-3 flex items-center gap-1.5">
              <ArrowDownCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
              سجل المصروفات المباشرة ({filteredExpenses.length})
            </h3>

            {filteredExpenses.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {filteredExpenses.map((exp) => (
                  <div 
                    key={exp.id} 
                    className="p-3 bg-rose-50/50 rounded-xl border border-rose-100/50 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded-sm font-bold">
                        {exp.category === "fawateer" ? "فواتير" : exp.category === "purchases" ? "مشتريات مخزن" : exp.category === "maintenance" ? "صيانة" : "أخرى"}
                      </span>
                      <p className="text-xs text-gray-700 font-medium mt-1">{exp.description}</p>
                      <span className="text-[9px] text-gray-400 font-mono block mt-0.5">
                        {new Date(exp.timestamp).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" })} | {exp.date}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-rose-600 text-sm">{formatCurrency(exp.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-xs py-10">لا توجد مصروفات مسجلة في هذه الفترة.</p>
            )}
          </div>
        </div>
      </div>

      {/* SESSION LOG DETAILED MODAL */}
      {selectedSessionLog && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-gray-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">تفاصيل الجلسة المؤرشفة</h3>
              </div>
              <button 
                onClick={() => setSelectedSessionLog(null)}
                className="text-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-right" dir="rtl">
              {/* Meta details */}
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100 text-xs">
                <div><span className="text-gray-400 block mb-0.5">اسم الزبون:</span> <strong className="text-gray-700 text-sm">{selectedSessionLog.customerName}</strong></div>
                <div><span className="text-gray-400 block mb-0.5">الجهاز المستخدم:</span> <strong className="text-gray-700 text-sm">{selectedSessionLog.deviceName} ({selectedSessionLog.deviceType})</strong></div>
                <div className="mt-1"><span className="text-gray-400 block mb-0.5">وقت بدء اللعب:</span> <strong className="text-gray-600 font-mono">{new Date(selectedSessionLog.startTime).toLocaleString("ar-JO")}</strong></div>
                <div className="mt-1"><span className="text-gray-400 block mb-0.5">وقت إنهاء اللعب:</span> <strong className="text-gray-600 font-mono">{new Date(selectedSessionLog.endTime).toLocaleString("ar-JO")}</strong></div>
              </div>

              {/* Player Count Segment Breakdown */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-700 block">تفصيل فترات اللعب وعدد اللاعبين:</span>
                <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50 space-y-1.5">
                  {selectedSessionLog.playersHistory && selectedSessionLog.playersHistory.length > 0 ? (
                    selectedSessionLog.playersHistory.map((seg, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-indigo-100/30 pb-1 last:border-0 last:pb-0">
                        <span className="text-gray-600 font-medium">اللاعبين: {seg.playersCount} لاعب(ين) | المدة: {Math.round(seg.minutes)} دقيقة</span>
                        <span className="font-mono font-bold text-indigo-700">{formatCurrency(seg.cost)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 font-medium">المدة الإجمالية: {Math.round(selectedSessionLog.totalDurationMinutes)} دقيقة</span>
                      <span className="font-mono font-bold text-indigo-700">{formatCurrency(selectedSessionLog.playCost)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sold Products list */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-700 block">المنتجات المباعة مع الجلسة:</span>
                {selectedSessionLog.products.length > 0 ? (
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1.5">
                    {selectedSessionLog.products.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-100/50 pb-1 last:border-0 last:pb-0">
                        <span className="text-gray-700 font-medium">{p.name} (عدد {p.quantity})</span>
                        <span className="font-mono text-gray-800">{formatCurrency(p.sellPrice * p.quantity)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-gray-400 py-1 bg-gray-50 border border-dashed rounded-lg">لا توجد منتجات مضافة.</p>
                )}
              </div>

              {/* Financial summary */}
              <div className="bg-gray-900 text-white p-4 rounded-xl border border-gray-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-400">تكلفة اللعب:</span>
                  <span className="font-mono">{formatCurrency(selectedSessionLog.playCost)} {selectedSessionLog.isPlayPrepaid ? "(دفع مسبق)" : ""}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">إجمالي المنتجات:</span>
                  <span className="font-mono">{formatCurrency(selectedSessionLog.productsCost)} {selectedSessionLog.isProductsPrepaid ? "(دفع مسبق)" : ""}</span>
                </div>
                <div className="flex justify-between border-t border-gray-800 pt-1.5 text-sm font-bold text-amber-300">
                  <span>المبلغ الإجمالي المحصل:</span>
                  <span className="font-mono">{formatCurrency(selectedSessionLog.grandTotal)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSessionLog(null)}
                className="bg-gray-900 text-white text-xs font-bold px-5 py-2 rounded-xl transition cursor-pointer"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
