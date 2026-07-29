import React, { useState } from "react";
import { LoggedSession, Expense, DeviceType } from "../types";
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  ShoppingBag, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight, 
  PieChart, 
  Activity, 
  Layers,
  Gamepad,
  Monitor,
  FileSpreadsheet,
  FileText,
  Loader2
} from "lucide-react";
import { formatCurrency } from "../utils/calculations";
import { exportReportToExcel, exportReportToPdf } from "../utils/exportReports";

interface ReportsViewProps {
  logs: LoggedSession[];
  expenses: Expense[];
  shiftDate: string;
}

type ReportPeriod = "today" | "month" | "year" | "custom";

export default function ReportsView({ logs, expenses, shiftDate }: ReportsViewProps) {
  const [period, setPeriod] = useState<ReportPeriod>("today");
  const [customStart, setCustomStart] = useState<string>(shiftDate);
  const [customEnd, setCustomEnd] = useState<string>(shiftDate);
  const [isExporting, setIsExporting] = useState<"excel" | "pdf" | null>(null);

  const periodLabel =
    period === "today" ? `اليوم (${shiftDate})` :
    period === "month" ? `شهر ${shiftDate.substring(0, 7)}` :
    period === "year" ? `سنة ${shiftDate.substring(0, 4)}` :
    `من ${customStart} إلى ${customEnd}`;

  // Helper to match dates
  const isMatch = (itemShiftDate: string, itemTimestamp: number): boolean => {
    const todayStr = shiftDate;
    const itemDate = new Date(itemTimestamp);
    
    if (period === "today") {
      return itemShiftDate === todayStr;
    }
    
    if (period === "month") {
      const activeMonth = todayStr.substring(0, 7); // "YYYY-MM"
      return itemShiftDate.startsWith(activeMonth);
    }
    
    if (period === "year") {
      const activeYear = todayStr.substring(0, 4); // "YYYY"
      return itemShiftDate.startsWith(activeYear);
    }

    if (period === "custom") {
      return itemShiftDate >= customStart && itemShiftDate <= customEnd;
    }

    return false;
  };

  // Filtered Logs & Expenses
  const filteredLogs = logs.filter(l => isMatch(l.shiftDate, l.endTime));
  const filteredExpenses = expenses.filter(e => isMatch(e.date, e.timestamp));

  // Key Financial Metrics
  const totalPlayRevenue = filteredLogs.reduce((sum, l) => sum + l.playCost, 0);
  const totalProductRevenue = filteredLogs.reduce((sum, l) => sum + l.productsCost, 0);
  const grossRevenue = totalPlayRevenue + totalProductRevenue;
  
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = grossRevenue - totalExpenses;

  // 1. Device Popularity (Utilization counters)
  const deviceStats: { [name: string]: { duration: number; revenue: number; type: DeviceType } } = {};
  filteredLogs.forEach(l => {
    if (!deviceStats[l.deviceName]) {
      deviceStats[l.deviceName] = { duration: 0, revenue: 0, type: l.deviceType };
    }
    deviceStats[l.deviceName].duration += l.totalDurationMinutes;
    deviceStats[l.deviceName].revenue += l.playCost + l.productsCost;
  });

  const sortedDevices = Object.entries(deviceStats).map(([name, stats]) => ({
    name,
    ...stats
  })).sort((a, b) => b.revenue - a.revenue);

  // 2. Best Selling Products
  const productStats: { [name: string]: { qty: number; revenue: number } } = {};
  filteredLogs.forEach(l => {
    l.products.forEach(p => {
      if (!productStats[p.name]) {
        productStats[p.name] = { qty: 0, revenue: 0 };
      }
      productStats[p.name].qty += p.quantity;
      productStats[p.name].revenue += p.sellPrice * p.quantity;
    });
  });

  const sortedProducts = Object.entries(productStats).map(([name, stats]) => ({
    name,
    ...stats
  })).sort((a, b) => b.revenue - a.revenue);

  // 3. Time Series for Custom SVG Charting
  // Let's group revenues by date to draw an elegant bar chart
  const dateMap: { [date: string]: { play: number; products: number; expenses: number } } = {};
  
  // Seed dates from last 5 days if today is selected
  const last5Days: string[] = [];
  const tempDate = new Date();
  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setDate(tempDate.getDate() - i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    last5Days.push(dateStr);
    dateMap[dateStr] = { play: 0, products: 0, expenses: 0 };
  }

  // Populate actual data
  filteredLogs.forEach(l => {
    if (!dateMap[l.shiftDate]) {
      dateMap[l.shiftDate] = { play: 0, products: 0, expenses: 0 };
    }
    dateMap[l.shiftDate].play += l.playCost;
    dateMap[l.shiftDate].products += l.productsCost;
  });

  filteredExpenses.forEach(e => {
    if (!dateMap[e.date]) {
      dateMap[e.date] = { play: 0, products: 0, expenses: 0 };
    }
    dateMap[e.date].expenses += e.amount;
  });

  // Convert to sorted list for the chart
  const chartData = Object.entries(dateMap).map(([date, val]) => ({
    date: date.substring(5), // "MM-DD"
    revenue: val.play + val.products,
    expenses: val.expenses
  })).sort((a, b) => a.date.localeCompare(b.date)).slice(-6); // show last 6 points

  const maxChartVal = Math.max(...chartData.map(d => Math.max(d.revenue, d.expenses)), 10);

  const profitMarginPercent = grossRevenue > 0 ? Math.round((netProfit / grossRevenue) * 100) : 0;

  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting("excel");
    try {
      await exportReportToExcel({
        periodLabel,
        generatedAt: new Date().toLocaleString("ar-EG"),
        totalPlayRevenue,
        totalProductRevenue,
        grossRevenue,
        totalExpenses,
        netProfit,
        profitMarginPercent,
        devices: sortedDevices,
        products: sortedProducts
      });
    } catch (error) {
      console.error("Excel export failed:", error);
      alert("تعذّر تصدير ملف Excel، حاول مرة أخرى.");
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportPdf = async () => {
    if (isExporting) return;
    setIsExporting("pdf");
    try {
      await exportReportToPdf("printable-report-template");
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("تعذّر تصدير ملف PDF، حاول مرة أخرى.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6" id="reports-view">
      
      {/* Filters and Header Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            التقارير المالية والتحليلات المحاسبية
          </h2>
          <p className="text-xs text-gray-500 mt-1">تتبع صافي الأرباح ونشاط الأجهزة ومبيعات الصالة بدقة متناهية</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5" dir="rtl">
          {[
            { id: "today", label: "اليوم" },
            { id: "month", label: "الشهر" },
            { id: "year", label: "السنة" },
            { id: "custom", label: "فترة مخصصة" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as ReportPeriod)}
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
            <div className="flex items-center gap-1.5 animate-fadeIn">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 focus:border-indigo-500 rounded-xl text-xs outline-hidden font-mono text-gray-700 bg-white"
              />
              <span className="text-xs text-gray-400">إلى</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-200 focus:border-indigo-500 rounded-xl text-xs outline-hidden font-mono text-gray-700 bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Export Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex flex-wrap items-center justify-between gap-3" dir="rtl">
        <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-gray-400" />
          تصدير التقرير الحالي ({periodLabel})
        </span>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
          >
            {isExporting === "excel" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            تصدير Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExporting !== null}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
          >
            {isExporting === "pdf" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            تصدير PDF
          </button>
        </div>
      </div>

      {/* Main Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6" dir="rtl">
        {/* Gross Revenue Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 font-bold block">إجمالي الدخل / المبيعات</span>
              <span className="font-mono text-2xl font-bold text-gray-900">{formatCurrency(grossRevenue)}</span>
            </div>
            <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-50 grid grid-cols-2 text-[11px] text-gray-500">
            <div>
              <span>ألعاب: </span>
              <strong className="text-indigo-600 font-mono">{formatCurrency(totalPlayRevenue)}</strong>
            </div>
            <div>
              <span>منتجات: </span>
              <strong className="text-emerald-600 font-mono">{formatCurrency(totalProductRevenue)}</strong>
            </div>
          </div>
        </div>

        {/* Expenses Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-400 font-bold block">مجموع المصاريف والمشتريات</span>
              <span className="font-mono text-2xl font-bold text-rose-600">{formatCurrency(totalExpenses)}</span>
            </div>
            <span className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
              <ArrowDownRight className="w-6 h-6" />
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-4">
            تشمل فواتير الصالة بالإضافة لمصاريف توريد مستلزمات المخزن الجديدة.
          </p>
        </div>

        {/* Net Profit Card */}
        <div className={`rounded-2xl border p-5 flex flex-col justify-between shadow-xs transition-all ${
          netProfit >= 0 ? "bg-indigo-950 text-white border-indigo-900" : "bg-rose-950 text-white border-rose-900"
        }`}>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-[10px] text-indigo-300 font-bold block">صافي الأرباح المحققة</span>
              <span className="font-mono text-2xl font-bold text-amber-400">{formatCurrency(netProfit)}</span>
            </div>
            <span className={`p-3 rounded-2xl ${netProfit >= 0 ? "bg-white/5 text-amber-400" : "bg-white/5 text-rose-400"}`}>
              {netProfit >= 0 ? <TrendingUp className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
            </span>
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-200">
            <span>نسبة الربح الإجمالية:</span>
            <span className="font-mono font-bold text-amber-400">
              {grossRevenue > 0 ? `${Math.round((netProfit / grossRevenue) * 100)}%` : "0%"}
            </span>
          </div>
        </div>
      </div>

      {/* Charts & Analytical Breakthroughs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" dir="rtl">
        {/* Custom SVG Dashboard Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Activity className="w-4.5 h-4.5 text-indigo-600" />
              المنحنى البياني المالي للوردية والأيام الأخيرة
            </h3>
            <p className="text-[11px] text-gray-400">مقارنة الإيرادات اليومية باللون الأزرق والمصروفات باللون الأحمر</p>
          </div>

          {/* Chart Drawing */}
          <div className="h-[200px] w-full bg-gray-50 rounded-2xl border border-gray-100/50 p-4 flex flex-col justify-between relative overflow-hidden">
            {/* Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-4 pointer-events-none opacity-40">
              <div className="border-b border-gray-200 w-full h-0"></div>
              <div className="border-b border-gray-200 w-full h-0"></div>
              <div className="border-b border-gray-200 w-full h-0"></div>
            </div>

            {/* Custom SVG Drawing */}
            <div className="flex-1 w-full flex items-end justify-around relative z-10 h-[140px] pt-4">
              {chartData.map((d, idx) => {
                const revHeightPercent = (d.revenue / maxChartVal) * 100;
                const expHeightPercent = (d.expenses / maxChartVal) * 100;

                return (
                  <div key={idx} className="flex flex-col items-center justify-end h-full w-12 group relative">
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full mb-1 bg-gray-900 text-white text-[9px] rounded-sm py-1 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none font-mono text-center">
                      إيراد: {d.revenue.toFixed(1)} <br /> مصروف: {d.expenses.toFixed(1)}
                    </div>

                    {/* Bars */}
                    <div className="flex gap-1.5 items-end justify-center w-full">
                      {/* Revenue Bar */}
                      <div 
                        className="w-3.5 bg-indigo-600 rounded-t-sm transition-all duration-500 hover:bg-indigo-700"
                        style={{ height: `${Math.max(revHeightPercent, 4)}%` }}
                      ></div>
                      {/* Expense Bar */}
                      <div 
                        className="w-3.5 bg-rose-500 rounded-t-sm transition-all duration-500 hover:bg-rose-600"
                        style={{ height: `${Math.max(expHeightPercent, 4)}%` }}
                      ></div>
                    </div>

                    {/* Date label */}
                    <span className="text-[9px] text-gray-400 font-mono mt-1.5 block shrink-0">{d.date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Device Popularity statistics */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <PieChart className="w-4.5 h-4.5 text-indigo-600" />
              أداء ومداخيل الأجهزة المختلفة
            </h3>
            <p className="text-[11px] text-gray-400">ترتيب الأجهزة الأكثر إنتاجية ودخلاً</p>
          </div>

          <div className="space-y-3 max-h-[220px] overflow-y-auto">
            {sortedDevices.length > 0 ? (
              sortedDevices.map((dev, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs items-center">
                    <span className="flex items-center gap-1 text-gray-700 font-medium">
                      {dev.type === DeviceType.PLAYSTATION ? (
                        <Gamepad className="w-3.5 h-3.5 text-gray-400" />
                      ) : (
                        <Monitor className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      {dev.name}
                    </span>
                    <span className="font-mono font-bold text-indigo-600">{formatCurrency(dev.revenue)}</span>
                  </div>
                  {/* Progress Line */}
                  <div className="w-full bg-gray-50 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${Math.min((dev.revenue / Math.max(...sortedDevices.map(d => d.revenue), 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400 block">الوقت الكلي الملعوب: {Math.round(dev.duration)} دقيقة</span>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-400 text-xs py-10">لم يتم تشغيل أية أجهزة في هذه الفترة.</p>
            )}
          </div>
        </div>
      </div>

      {/* Best selling inventory products breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-xs" dir="rtl">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
            <ShoppingBag className="w-4.5 h-4.5 text-indigo-600" />
            ترتيب المنتجات والمشروبات الأكثر مبيعاً
          </h3>
          <p className="text-[11px] text-gray-400">قائمة السلع والطلبات الأكثر طلباً من قبل زبائن الصالة</p>
        </div>

        {sortedProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {sortedProducts.map((prod, idx) => (
              <div key={idx} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-gray-800 text-xs">{prod.name}</h4>
                  <span className="text-[10px] text-gray-400 mt-1 block">الكمية المباعة: {prod.qty} حبة</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-gray-400 block font-sans">إجمالي المبيع</span>
                  <span className="font-mono text-xs font-bold text-emerald-700">{formatCurrency(prod.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-xs py-8 border border-dashed rounded-xl">لم يتم بيع أي منتجات في هذه الفترة.</p>
        )}
      </div>

      {/* ============================================================ */}
      {/* قالب الطباعة المخفي: يُستخدم فقط كمصدر لتصوير تقرير الـ PDF     */}
      {/* موضوع خارج حدود الشاشة حتى لا يظهر للمستخدم أثناء الاستخدام العادي */}
      {/* ============================================================ */}
      <div
        id="printable-report-template"
        dir="rtl"
        style={{ position: "absolute", top: "-9999px", left: "-9999px", width: "800px", background: "#ffffff", color: "#000000", padding: "40px", fontFamily: "Arial, sans-serif" }}
      >
        <div style={{ textAlign: "center", borderBottom: "3px solid #4f46e5", paddingBottom: "16px", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: "bold", color: "#1e1b4b", margin: 0 }}>Mr.Gamer — تقرير مالي</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "8px" }}>الفترة: {periodLabel}</p>
          <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>تاريخ الإصدار: {new Date().toLocaleString("ar-EG")}</p>
        </div>

        {/* Summary table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px", fontSize: "13px" }}>
          <tbody>
            {[
              ["إيرادات الألعاب", formatCurrency(totalPlayRevenue)],
              ["إيرادات المنتجات", formatCurrency(totalProductRevenue)],
              ["إجمالي الدخل", formatCurrency(grossRevenue)],
              ["إجمالي المصاريف والمشتريات", formatCurrency(totalExpenses)],
              ["صافي الأرباح", formatCurrency(netProfit)],
              ["نسبة الربح الإجمالية", `${profitMarginPercent}%`],
            ].map(([label, value], i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#ffffff" }}>
                <td style={{ padding: "10px 14px", border: "1px solid #e5e7eb", fontWeight: "bold", color: "#374151" }}>{label}</td>
                <td style={{ padding: "10px 14px", border: "1px solid #e5e7eb", color: "#111827", fontWeight: "bold" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Device performance table */}
        <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#1e1b4b", marginBottom: "10px" }}>أداء الأجهزة</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "28px", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#4f46e5", color: "#ffffff" }}>
              <th style={{ padding: "8px 12px", border: "1px solid #4338ca", textAlign: "right" }}>الجهاز</th>
              <th style={{ padding: "8px 12px", border: "1px solid #4338ca", textAlign: "right" }}>الوقت الملعوب (دقيقة)</th>
              <th style={{ padding: "8px 12px", border: "1px solid #4338ca", textAlign: "right" }}>الإيراد</th>
            </tr>
          </thead>
          <tbody>
            {sortedDevices.length > 0 ? sortedDevices.map((d, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#ffffff" }}>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{d.name}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{Math.round(d.duration)}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: "bold" }}>{formatCurrency(d.revenue)}</td>
              </tr>
            )) : (
              <tr><td colSpan={3} style={{ padding: "12px", border: "1px solid #e5e7eb", textAlign: "center", color: "#9ca3af" }}>لا توجد بيانات لهذه الفترة</td></tr>
            )}
          </tbody>
        </table>

        {/* Top products table */}
        <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#1e1b4b", marginBottom: "10px" }}>المنتجات الأكثر مبيعاً</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ background: "#059669", color: "#ffffff" }}>
              <th style={{ padding: "8px 12px", border: "1px solid #047857", textAlign: "right" }}>المنتج</th>
              <th style={{ padding: "8px 12px", border: "1px solid #047857", textAlign: "right" }}>الكمية</th>
              <th style={{ padding: "8px 12px", border: "1px solid #047857", textAlign: "right" }}>إجمالي المبيع</th>
            </tr>
          </thead>
          <tbody>
            {sortedProducts.length > 0 ? sortedProducts.map((p, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#f9fafb" : "#ffffff" }}>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{p.name}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}>{p.qty}</td>
                <td style={{ padding: "8px 12px", border: "1px solid #e5e7eb", fontWeight: "bold" }}>{formatCurrency(p.revenue)}</td>
              </tr>
            )) : (
              <tr><td colSpan={3} style={{ padding: "12px", border: "1px solid #e5e7eb", textAlign: "center", color: "#9ca3af" }}>لا توجد بيانات لهذه الفترة</td></tr>
            )}
          </tbody>
        </table>

        <p style={{ textAlign: "center", fontSize: "10px", color: "#9ca3af", marginTop: "30px" }}>
          تم إنشاء هذا التقرير تلقائياً بواسطة تطبيق Mr.Gamer
        </p>
      </div>
    </div>
  );
}
