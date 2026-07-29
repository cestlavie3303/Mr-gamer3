import React, { useState, useEffect } from "react";
import { 
  Device, 
  DeviceType, 
  SessionType, 
  ActiveSession, 
  Product, 
  Settings, 
  PlaySegment 
} from "../types";
import { 
  Gamepad, 
  Monitor, 
  Play, 
  Pause, 
  RefreshCw, 
  Plus, 
  Trash2, 
  DollarSign, 
  Clock, 
  User, 
  Users, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Package, 
  Lock, 
  PlusCircle, 
  ChevronRight,
  Sparkles,
  Activity
} from "lucide-react";
import { 
  calculatePlayCost, 
  calculateActivePlaytimeMs, 
  getHourlyRate, 
  formatDuration, 
  formatCurrency,
  isOfferActive
} from "../utils/calculations";

interface DashboardViewProps {
  devices: Device[];
  products: Product[];
  settings: Settings;
  shiftDate: string;
  onStartSession: (deviceId: string, sessionData: any) => void;
  onPauseSession: (deviceId: string) => void;
  onResumeSession: (deviceId: string) => void;
  onChangePlayers: (deviceId: string, count: number) => void;
  onAddProductToSession: (deviceId: string, productId: string, quantity: number) => void;
  onRemoveProductFromSession: (deviceId: string, productId: string) => void;
  onDecrementProductInSession: (deviceId: string, productId: string) => void;
  onTogglePlayPrepaid: (deviceId: string) => void;
  onToggleProductsPrepaid: (deviceId: string) => void;
  onExtendSession: (deviceId: string, minutes: number, openEnded?: boolean) => void;
  onEndSession: (deviceId: string) => void;
  onCancelSession: (deviceId: string) => void;
  onEndDay: (password: string) => boolean;
}

export default function DashboardView({
  devices,
  products,
  settings,
  shiftDate,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onChangePlayers,
  onAddProductToSession,
  onRemoveProductFromSession,
  onDecrementProductInSession,
  onTogglePlayPrepaid,
  onToggleProductsPrepaid,
  onExtendSession,
  onEndSession,
  onCancelSession,
  onEndDay,
}: DashboardViewProps) {
  // Modal states
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEndDayModalOpen, setIsEndDayModalOpen] = useState(false);

  // Form states for starting session
  const [customerName, setCustomerName] = useState("");
  const [playersCount, setPlayersCount] = useState<number>(1);
  const [sessionType, setSessionType] = useState<SessionType>(SessionType.ONE_HOUR);
  const [customMinutes, setCustomMinutes] = useState<string>("");
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [isPlayPrepaid, setIsPlayPrepaid] = useState(false);

  // Confirmation state for deleting a product from session
  const [productToDelete, setProductToDelete] = useState<{ deviceId: string; productId: string } | null>(null);

  // End day state
  const [endDayPassword, setEndDayPassword] = useState("");
  const [endDayError, setEndDayError] = useState("");

  // Product adding inside details modal
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<string>("");
  const [productQuantityToAdd, setProductQuantityToAdd] = useState<number>(1);

  // Extension state inside details modal
  const [isExtendOpen, setIsExtendOpen] = useState(false);
  const [extendMinutes, setExtendMinutes] = useState<number>(30);
  const [extendCustomMinutes, setExtendCustomMinutes] = useState<string>("");
  const [isExtendCustom, setIsExtendCustom] = useState(false);
  const [isExtendOpenEnded, setIsExtendOpenEnded] = useState(false);
  const [isExtendByAmount, setIsExtendByAmount] = useState(false);
  const [extendAmount, setExtendAmount] = useState<string>("");

  // Low stock products warning
  const lowStockProducts = products.filter(p => p.currentStock <= p.minStockThreshold);

  // Live reference of the currently selected device to ensure real-time updates and prevent state desync
  const liveSelectedDevice = selectedDevice 
    ? devices.find(d => d.id === selectedDevice.id) || selectedDevice 
    : null;

  // Custom confirmation states to bypass browser dialog restrictions in iframes
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showExtendSuccess, setShowExtendSuccess] = useState(false);

  // Dynamic ticking values to update the UI cost and elapsed timers in real-time
  const [currentTime, setCurrentTime] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Set default values when start modal opens
  const handleOpenStartModal = (device: Device) => {
    setSelectedDevice(device);
    setCustomerName("");
    setPlayersCount(device.type === DeviceType.PLAYSTATION ? 2 : 1);
    setSessionType(SessionType.ONE_HOUR);
    setIsPlayPrepaid(false);
    setIsStartModalOpen(true);
  };

  const handleOpenDetailsModal = (device: Device) => {
    setSelectedDevice(device);
    setIsDetailsModalOpen(true);
    setIsExtendOpen(false);
    setSelectedProductToAdd("");
    setProductQuantityToAdd(1);
  };

  const submitStartSession = () => {
    if (!selectedDevice) return;

    let finalDurationMinutes = 60;
    if (sessionType === SessionType.HALF_HOUR) finalDurationMinutes = 30;
    else if (sessionType === SessionType.ONE_HOUR) finalDurationMinutes = 60;
    else if (sessionType === SessionType.TWO_HOURS) finalDurationMinutes = 120;
    else if (sessionType === SessionType.OPEN) finalDurationMinutes = -1; // open
    else if (sessionType === SessionType.CUSTOM) {
      finalDurationMinutes = parseInt(customMinutes) || 30;
    } else if (sessionType === SessionType.BY_AMOUNT) {
      const amount = parseFloat(paidAmount) || 1.0;
      const rate = getHourlyRate(selectedDevice.type, playersCount, settings);
      finalDurationMinutes = Math.round((amount / rate) * 60);
    }

    onStartSession(selectedDevice.id, {
      customerName: customerName.trim() || "زبون مجهول",
      sessionType,
      selectedDurationMinutes: finalDurationMinutes,
      targetAmount: sessionType === SessionType.BY_AMOUNT ? parseFloat(paidAmount) || 0 : 0,
      initialPlayersCount: playersCount,
      isPlayPrepaid,
    });

    setIsStartModalOpen(false);
  };

  const handleEndDaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (endDayPassword === "0000") {
      const success = onEndDay(endDayPassword);
      if (success) {
        setIsEndDayModalOpen(false);
        setEndDayPassword("");
        setEndDayError("");
        alert("تم إقفال اليوم المالي وبدء يوم جديد بنجاح!");
      } else {
        setEndDayError("فشل إقفال اليوم. تأكد من إغلاق كافة الأجهزة أولاً.");
      }
    } else {
      setEndDayError("كلمة المرور غير صحيحة! جرب 0000");
    }
  };

  return (
    <div className="space-y-2.5" id="dashboard-container">
      {/* Top Bar with shift info and actions */}
      <div className="flex flex-row items-center justify-between bg-white px-3 py-2 rounded-xl shadow-xs border border-gray-100 gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-sm font-extrabold text-gray-900 font-sans tracking-tight">اللوحة الرئيسية</h1>
          </div>
          <span className="h-4 w-px bg-gray-200 hidden sm:inline" />
          <p className="text-gray-500 text-xs hidden sm:inline">
            الوردية المفتوحة: <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">{shiftDate}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-gray-500 text-[11px] sm:hidden">
            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">{shiftDate}</span>
          </p>
          <button
            onClick={() => setIsEndDayModalOpen(true)}
            className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition shadow-sm hover:shadow-rose-100 cursor-pointer"
            id="btn-end-day"
          >
            <Lock className="w-3.5 h-3.5" />
            إنهاء الوردية
          </button>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3 animate-pulse" id="stock-warning-banner">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 text-sm">تنبيه المخزون المنخفض</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              المنتجات التالية نقصت عن الحد الأدنى في المخزن:{" "}
              <span className="font-medium">
                {lowStockProducts.map(p => `${p.name} (المتبقي: ${p.currentStock})`).join("، ")}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Grid of Devices - highly optimized space density */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2" id="devices-grid">
        {devices.map((device) => {
          const isActive = device.status === "active";
          const isPaused = device.status === "paused";
          const session = device.activeSession;
          
          let playCost = 0;
          let playtimeMs = 0;
          let isTimeUp = false;
          let progressPercent = 0;
          let remainingStr = "";
 
          if (isActive || isPaused) {
            if (session) {
              playCost = calculatePlayCost(session, settings, currentTime);
              playtimeMs = calculateActivePlaytimeMs(session, currentTime);
              
              // Check time limits
              if (session.selectedDurationMinutes > 0) {
                const targetMs = session.selectedDurationMinutes * 60 * 1000;
                progressPercent = Math.min((playtimeMs / targetMs) * 100, 100);
                if (playtimeMs >= targetMs) {
                  isTimeUp = true;
                }
                const remainingMs = Math.max(targetMs - playtimeMs, 0);
                remainingStr = formatDuration(remainingMs);
              }
            }
          }
 
          // Active segment players count
          const currentPlayersCount = session?.segments[session.segments.length - 1]?.playersCount || 0;
 
          return (
            <div
              key={device.id}
              id={`device-card-${device.id}`}
              onClick={() => {
                if (isActive || isPaused) {
                  handleOpenDetailsModal(device);
                } else {
                  handleOpenStartModal(device);
                }
              }}
              className={`relative bg-white rounded-xl border transition-all duration-300 overflow-hidden flex flex-col h-full cursor-pointer select-none group gaming-card ${
                isTimeUp 
                  ? "border-rose-500 gaming-glow-rose bg-rose-500/[0.02]"
                  : isActive
                  ? isPaused
                    ? "border-amber-400 gaming-glow-amber bg-amber-500/[0.01] hover:border-amber-500"
                    : "border-indigo-500 gaming-glow-indigo bg-indigo-500/[0.01] hover:border-indigo-600"
                  : "border-gray-200 hover:border-emerald-400 ready-card-pattern hover:shadow-lg hover:shadow-emerald-500/5 hover:-translate-y-[2px]"
              }`}
            >
              {/* Card Header - compact */}
              <div className={`p-2 flex items-center justify-between border-b ${
                isTimeUp ? "bg-rose-50/50 border-rose-100" : isActive ? "bg-indigo-50/30 border-indigo-50" : "bg-gray-50/30 border-gray-100/50"
              }`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className={`p-1.5 rounded-lg shrink-0 transition-all duration-300 group-hover:scale-105 ${
                    isTimeUp
                      ? "bg-rose-100 text-rose-700"
                      : isPaused
                      ? "bg-amber-100 text-amber-700"
                      : isActive
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-gray-100 text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600"
                  }`}>
                    {device.type === DeviceType.PLAYSTATION ? (
                      <Gamepad className="w-3.5 h-3.5" />
                    ) : (
                      <Monitor className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="truncate text-right">
                    <h3 className="font-extrabold text-gray-900 text-[11px] sm:text-xs leading-tight truncate">{device.name}</h3>
                    <span className="text-[8px] font-bold text-gray-400 font-mono uppercase tracking-wider block mt-0.5 leading-none">{device.type}</span>
                  </div>
                </div>
 
                {/* Status Indicator Badge */}
                <span className={`inline-flex items-center gap-0.5 text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                  isTimeUp
                    ? "bg-rose-600 text-white animate-pulse"
                    : isPaused
                    ? "bg-amber-100 text-amber-800"
                    : isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-gray-100 text-gray-600 group-hover:bg-emerald-50 group-hover:text-emerald-700"
                }`}>
                  <span className={`w-1 h-1 rounded-full shrink-0 ${
                    isTimeUp ? "bg-white animate-ping" : isPaused ? "bg-amber-500 animate-pulse" : isActive ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                  }`} />
                  {isTimeUp ? "انتهى!" : isPaused ? "مؤقت" : isActive ? "نشط" : "متاح"}
                </span>
              </div>
 
              {/* Card Body & Content */}
              <div className="p-1.5 flex-1 flex flex-col justify-between">
                {isActive || isPaused ? (
                  <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                    {/* Customer & Player Count Info */}
                    <div className="flex items-center justify-between text-[9px] text-gray-500 pb-0.5 border-b border-gray-100/50">
                      <span className="flex items-center gap-0.5 font-bold text-gray-700 truncate max-w-[65%] text-right">
                        <User className="w-2.5 h-2.5 text-gray-400 shrink-0" />
                        {session?.customerName || "زبون"}
                      </span>
                      <span className="font-mono text-[8px] font-bold bg-indigo-50 text-indigo-700 px-1 py-0.2 rounded shrink-0">
                        {currentPlayersCount} لاعب
                      </span>
                    </div>
 
                    {/* Timer Display and Cost */}
                    <div className="flex items-center justify-between px-1.5 py-1 bg-gray-50/50 rounded-lg border border-gray-100/50 relative overflow-hidden">
                      <span className={`font-mono text-xs font-black tracking-tight ${
                        isTimeUp ? "text-rose-600 animate-pulse" : isPaused ? "text-amber-600" : "text-gray-900"
                      }`}>
                        {formatDuration(playtimeMs)}
                      </span>
                      <span className="text-[9px] font-mono font-black text-emerald-600 flex items-center gap-0.5">
                        {formatCurrency(playCost)}
                      </span>
                    </div>
 
                    {/* Expected / Remaining Time Progress */}
                    <div className="mt-auto">
                      {session?.selectedDurationMinutes && session.selectedDurationMinutes > 0 ? (
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[8px] text-gray-500 leading-none">
                            <span className="font-bold">متبقي: <span className="font-mono font-black text-rose-600">{remainingStr}</span></span>
                            <span className="font-mono font-bold">{Math.round(progressPercent)}%</span>
                          </div>
                          <div className="w-full bg-gray-100 h-0.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${
                                isTimeUp ? "bg-rose-600 animate-pulse" : "bg-indigo-600"
                              }`}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-800 text-[8px] py-0.5 px-1 rounded text-center font-bold flex items-center justify-center gap-0.5 border border-emerald-100/30">
                          <Sparkles className="w-2 h-2 text-emerald-500 shrink-0" />
                          وقت مفتوح
                        </div>
                      )}
                    </div>
 
                    {/* Extra Info (Products) & Pause/Play Trigger */}
                    <div className="flex items-center justify-between pt-0.5 border-t border-gray-100/50 mt-0.5">
                      {session?.addedProducts && session?.addedProducts.length > 0 ? (
                        <div className="flex items-center gap-0.5 bg-amber-50 text-amber-700 px-1 py-0.2 rounded text-[8px] font-mono font-bold">
                          <Package className="w-2.5 h-2.5 shrink-0" />
                          <span>+{session.addedProducts.reduce((sum, p) => sum + p.quantity, 0)} طلب</span>
                        </div>
                      ) : (
                        <div className="w-1 h-1" />
                      )}
 
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Stop opening the modal
                          isPaused ? onResumeSession(device.id) : onPauseSession(device.id);
                        }}
                        className={`p-0.5 rounded transition-all duration-200 shrink-0 cursor-pointer ${
                          isPaused
                            ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                            : "bg-amber-100 hover:bg-amber-200 text-amber-800"
                        }`}
                        title={isPaused ? "استئناف" : "إيقاف مؤقت"}
                        id={`btn-pause-resume-${device.id}`}
                      >
                        {isPaused ? <Play className="w-2.5 h-2.5 fill-emerald-800 text-emerald-800" /> : <Pause className="w-2.5 h-2.5 fill-amber-800 text-amber-800" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-2 text-center">
                    <p className="text-[9px] text-gray-400 mb-1 leading-tight">جاهز ومتاح</p>
                    <span 
                      className="text-[9px] text-emerald-700 font-extrabold bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white px-2 py-0.5 rounded transition-all duration-300 font-sans flex items-center gap-0.5 shadow-2xs"
                      id={`btn-start-session-${device.id}`}
                    >
                      <Plus className="w-2.5 h-2.5 stroke-[3]" />
                      بدء الجلسة
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* START SESSION MODAL */}
      {isStartModalOpen && selectedDevice && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fadeIn" id="start-session-modal">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-gray-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gamepad className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">بدء جلسة: {selectedDevice.name}</h3>
              </div>
              <button 
                onClick={() => setIsStartModalOpen(false)}
                className="text-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh] text-right" dir="rtl">
              {/* Customer Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">اسم الزبون (اختياري)</label>
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="مثال: أحمد، محمد ..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl pr-10 pl-4 py-2.5 text-sm text-gray-800 outline-hidden font-sans"
                    id="input-customer-name"
                  />
                </div>
              </div>

              {/* Players Count selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block">عدد اللاعبين</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPlayersCount(num)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        playersCount === num
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                      id={`btn-players-${num}`}
                    >
                      {num} لاعب{num > 1 ? "ين" : ""}
                    </button>
                  ))}
                </div>
                {selectedDevice.type === DeviceType.PLAYSTATION && (
                  <p className="text-[10px] text-gray-400 text-right mt-1">
                    * ملاحظة: 1-2 لاعب بسعر موحد، 3 لاعبين و4 لاعبين بسعر إضافي حسب الإعدادات.
                  </p>
                )}
              </div>

              {/* Hourly Rate Information and Active Offers status */}
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-1.5 text-right">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-600">سعر الساعة الحالي لهذه الوضعية:</span>
                  <span className="font-mono font-bold text-gray-900 bg-white px-2 py-1 rounded-lg border border-gray-100">
                    {getHourlyRate(selectedDevice.type, playersCount, settings)} ل.س
                  </span>
                </div>

                {isOfferActive(settings, selectedDevice.type) && (
                  <div className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-xl border border-amber-100/60 flex items-center gap-1.5 animate-pulse mt-1">
                    <span className="shrink-0">🎁</span>
                    <span>عرض نشط حالياً! تم تطبيق سعر العرض التلقائي المخفّض.</span>
                  </div>
                )}
              </div>

              {/* Session Type / Duration selection */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-700 block">مدة الجلسة</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: SessionType.HALF_HOUR, label: "نصف ساعة" },
                    { type: SessionType.ONE_HOUR, label: "ساعة كاملة" },
                    { type: SessionType.TWO_HOURS, label: "ساعتين" },
                    { type: SessionType.OPEN, label: "وقت مفتوح" },
                    { type: SessionType.CUSTOM, label: "تحديد وقت" },
                    { type: SessionType.BY_AMOUNT, label: "حسب المبلغ" },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setSessionType(item.type)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        sessionType === item.type
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                      id={`btn-session-type-${item.type}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {/* Sub Inputs based on selection */}
                {sessionType === SessionType.CUSTOM && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1.5 animate-fadeIn">
                    <label className="text-[11px] font-bold text-gray-600 block">حدد الوقت بالدقائق:</label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-hidden font-mono"
                      id="input-custom-minutes"
                    />
                  </div>
                )}

                {sessionType === SessionType.BY_AMOUNT && (
                  <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2 animate-fadeIn">
                    <label className="text-[11px] font-bold text-gray-600 block">المبلغ المدفوع (ل.س):</label>
                    <input
                      type="text"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-hidden font-mono"
                      id="input-paid-amount"
                    />
                    <div className="text-[10px] text-gray-500 font-mono">
                      الساعة = {getHourlyRate(selectedDevice.type, playersCount, settings)} ل.س | الوقت المقابل ={" "}
                      {Math.round(((parseFloat(paidAmount) || 0) / getHourlyRate(selectedDevice.type, playersCount, settings)) * 60)} دقيقة
                    </div>
                  </div>
                )}
              </div>

              {/* Prepayment state */}
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-xs font-bold text-gray-700">تم الدفع مسبقاً للجلسة</span>
                <input
                  type="checkbox"
                  checked={isPlayPrepaid}
                  onChange={(e) => setIsPlayPrepaid(e.target.checked)}
                  className="w-4.5 h-4.5 rounded-sm border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  id="checkbox-play-prepaid"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex gap-3">
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="flex-1 py-3 rounded-2xl text-xs font-bold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-all duration-200 cursor-pointer active:scale-95"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={submitStartSession}
                className="flex-[2] py-3 rounded-2xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200 shadow-lg shadow-indigo-600/20 cursor-pointer active:scale-95 flex items-center justify-center gap-2 group"
                id="btn-confirm-start-session"
              >
                <Play className="w-4 h-4 text-indigo-200 group-hover:scale-110 transition-transform" />
                <span>بدء الجلسة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAILS / MANAGEMENT MODAL */}
      {isDetailsModalOpen && liveSelectedDevice && liveSelectedDevice.activeSession && (
        (() => {
          const session = liveSelectedDevice.activeSession;
          const playCost = calculatePlayCost(session, settings, currentTime);
          const playtimeMs = calculateActivePlaytimeMs(session, currentTime);
          
          const currentPlayersCount = session.segments[session.segments.length - 1]?.playersCount || 0;

          // Product calculations
          const productsCost = session.addedProducts.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
          const grandTotal = playCost + productsCost;

          // Deduct prepayments
          let prepaidPlayDeduction = session.isPlayPrepaid ? playCost : 0;
          let prepaidProdDeduction = session.isProductsPrepaid ? productsCost : 0;
          
          // prepaid products calculation can also be specific to products marked isPrepaid
          const exactPrepaidProductsCost = session.addedProducts
             .filter(p => p.isPrepaid)
             .reduce((sum, p) => sum + (p.sellPrice * p.quantity), 0);
          
          // If general products prepaid toggle is on, it applies to all, otherwise check item-by-item
          const productsPaidAmount = session.isProductsPrepaid ? productsCost : exactPrepaidProductsCost;
          const netCostToPay = grandTotal - prepaidPlayDeduction - productsPaidAmount;

          return (
            <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 transition-all duration-300 animate-fadeIn" id="details-modal">
              <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[96vh]">
                
                {/* Modal Header */}
                <div className="bg-indigo-900 text-white p-4 sm:p-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-300" />
                    <div>
                      <h3 className="font-bold text-sm sm:text-base">إدارة جلسة {liveSelectedDevice.name}</h3>
                      <p className="text-[10px] text-indigo-200 mt-0.5">اسم الزبون: {session.customerName}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsDetailsModalOpen(false)}
                    className="text-indigo-200 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-indigo-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-3 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 text-right flex-1" dir="rtl">
                  
                  {/* Status indicators */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div className="bg-gray-50 border border-gray-100 p-2 sm:p-3 rounded-xl text-center">
                      <span className="text-[9px] sm:text-[10px] text-gray-400 block mb-0.5">وقت الدخول</span>
                      <span className="font-mono font-semibold text-gray-700 text-[10px] sm:text-xs">
                        {new Date(session.startTime).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-2 sm:p-3 rounded-xl text-center">
                      <span className="text-[9px] sm:text-[10px] text-gray-400 block mb-0.5">مدة اللعب</span>
                      <span className="font-mono font-bold text-indigo-700 text-xs sm:text-sm">
                        {formatDuration(playtimeMs)}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-2 sm:p-3 rounded-xl text-center">
                      <span className="text-[9px] sm:text-[10px] text-gray-400 block mb-0.5">نوع الجلسة</span>
                      <span className="font-semibold text-gray-700 text-[10px] sm:text-xs truncate">
                        {session.sessionType === SessionType.OPEN ? "وقت مفتوح" : `محددة (${session.selectedDurationMinutes} د)`}
                      </span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 p-2 sm:p-3 rounded-xl text-center">
                      <span className="text-[9px] sm:text-[10px] text-gray-400 block mb-0.5">اللاعبين حالياً</span>
                      <span className="font-semibold text-emerald-700 text-[10px] sm:text-xs">
                        {currentPlayersCount} لاعبين
                      </span>
                    </div>
                  </div>

                  {/* 1. Add Products to Session Section */}
                  <div className="space-y-3 border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-bold text-gray-700">إضافة طلبات ومنتجات للزبون</h4>
                    <div className="space-y-2">
                      <select
                        value={selectedProductToAdd}
                        onChange={(e) => setSelectedProductToAdd(e.target.value)}
                        className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs bg-white cursor-pointer"
                      >
                        <option value="">اختر المنتج ...</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id} disabled={p.currentStock <= 0}>
                            {p.name} - سعر البيع ({formatCurrency(p.sellPrice)}) [المخزون: {p.currentStock}]
                          </option>
                        ))}
                      </select>

                      <div className="flex gap-2">
                        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden shrink-0 bg-white">
                          <button
                            type="button"
                            onClick={() => setProductQuantityToAdd(prev => Math.max(1, prev - 1))}
                            className="w-7 sm:w-8 h-full px-0 py-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition cursor-pointer font-bold text-sm"
                          >
                            −
                          </button>
                          <span className="w-6 sm:w-8 text-center text-xs font-mono font-bold text-gray-800 select-none">
                            {productQuantityToAdd}
                          </span>
                          <button
                            type="button"
                            onClick={() => setProductQuantityToAdd(prev => prev + 1)}
                            className="w-7 sm:w-8 h-full px-0 py-2 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition cursor-pointer font-bold text-sm"
                          >
                            +
                          </button>
                        </div>

                        {selectedProductToAdd && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductToAdd("");
                              setProductQuantityToAdd(1);
                            }}
                            title="إلغاء اختيار المنتج"
                            className="w-9 shrink-0 flex items-center justify-center border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedProductToAdd) return;
                            onAddProductToSession(liveSelectedDevice.id, selectedProductToAdd, productQuantityToAdd);
                            setSelectedProductToAdd("");
                            setProductQuantityToAdd(1);
                          }}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          إضافة
                        </button>
                      </div>
                    </div>

                    {/* Added Products List with Trash Confirmation */}
                    {session.addedProducts && session.addedProducts.length > 0 ? (
                      <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-[10px] sm:text-xs text-right table-fixed sm:table-auto">
                          <thead className="bg-gray-100 text-gray-600 font-bold">
                            <tr>
                              <th className="px-1 py-2 sm:p-2.5 w-[25%] sm:w-auto">المنتج</th>
                              <th className="px-1 py-2 sm:p-2.5 text-center w-[18%] sm:w-auto">الكمية</th>
                              <th className="px-1 py-2 sm:p-2.5 text-center w-[15%] sm:w-auto">السعر</th>
                              <th className="px-1 py-2 sm:p-2.5 text-center w-[15%] sm:w-auto">الإجمالي</th>
                              <th className="px-1 py-2 sm:p-2.5 text-center w-[20%] sm:w-auto">الحالة</th>
                              <th className="px-1 py-2 sm:p-2.5 text-center w-[7%] sm:w-auto"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {session.addedProducts.map((p) => (
                              <tr key={p.productId} className="hover:bg-gray-100/50">
                                <td className="px-1 py-2 sm:p-2.5 font-medium text-gray-800 truncate" title={p.name}>{p.name}</td>
                                <td className="px-1 py-2 sm:p-2.5 text-center font-mono">
                                  <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onDecrementProductInSession(liveSelectedDevice.id, p.productId)}
                                      className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition cursor-pointer font-bold"
                                    >
                                      −
                                    </button>
                                    <span className="w-4 sm:w-5 text-center font-bold text-gray-800">{p.quantity}</span>
                                    <button
                                      type="button"
                                      disabled={(products.find(pr => pr.id === p.productId)?.currentStock ?? 0) <= 0}
                                      onClick={() => onAddProductToSession(liveSelectedDevice.id, p.productId, 1)}
                                      className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="px-1 py-2 sm:p-2.5 text-center font-mono truncate">{formatCurrency(p.sellPrice)}</td>
                                <td className="px-1 py-2 sm:p-2.5 text-center font-mono font-bold text-gray-800 truncate">{formatCurrency(p.sellPrice * p.quantity)}</td>
                                <td className="px-1 py-2 sm:p-2.5 text-center">
                                  <span className={`inline-block px-1 py-0.5 sm:px-1.5 sm:py-0.5 rounded-sm text-[8px] sm:text-[10px] font-bold ${
                                    (session.isProductsPrepaid || p.isPrepaid) ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                  }`}>
                                    {(session.isProductsPrepaid || p.isPrepaid) ? "تم الدفع مسبقاً" : "مع الحساب"}
                                  </span>
                                </td>
                                <td className="px-1 py-2 sm:p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setProductToDelete({ deviceId: liveSelectedDevice.id, productId: p.productId })}
                                    className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded-md transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-[11px] text-gray-400 text-center py-2">لا توجد منتجات مضافة بعد للجلسة.</p>
                    )}
                  </div>

                  {/* 2. Modify Players Count ON THE FLY (Without Retroactivity!) */}
                  <div className="space-y-2.5 border-t border-gray-100 pt-4">
                    <h4 className="text-xs font-bold text-gray-700">تعديل عدد اللاعبين (بدون أثر رجعي)</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            if (num !== currentPlayersCount) {
                              onChangePlayers(liveSelectedDevice.id, num);
                            }
                          }}
                          className={`py-2 rounded-xl text-[10px] sm:text-xs font-bold transition cursor-pointer border ${
                            currentPlayersCount === num
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {num} لاعب{num > 1 ? "ين" : ""} {num === currentPlayersCount ? "✓" : ""}
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-between items-center text-[10px] sm:text-[11px] text-gray-500 bg-gray-50 p-2 rounded-xl border border-gray-100">
                      <span>سعر الساعة الحالي لهذه الوضعية:</span>
                      <span className="font-mono font-bold text-gray-900 flex items-center gap-1 sm:gap-1.5">
                        {getHourlyRate(liveSelectedDevice.type, currentPlayersCount, settings)} ل.س
                        {isOfferActive(settings, liveSelectedDevice.type) && (
                          <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] animate-pulse">🎁 عرض!</span>
                        )}
                      </span>
                    </div>
                    
                    {/* Segments History list for complete transparency */}
                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <span className="text-[10px] text-gray-400 font-bold block mb-2">سجل الفترات الملعوبة للجلسة الحالية:</span>
                      <div className="space-y-1.5 max-h-[80px] overflow-y-auto">
                        {session.segments.map((seg, i) => (
                          <div key={i} className="flex justify-between items-center text-[10px] sm:text-xs border-b border-gray-100/50 pb-1 last:border-0 last:pb-0">
                            <span className="text-gray-500">فترة {i+1}: عدد اللاعبين ({seg.playersCount})</span>
                            <span className="font-mono font-medium text-gray-700">
                              {formatDuration(seg.accumulatedMs + (i === session.segments.length - 1 && !liveSelectedDevice.activeSession?.isPaused ? (currentTime - session.lastTickTimestamp) : 0))} 
                              {" ⟵ "} 
                              <span className="text-emerald-700 font-bold">
                                {formatCurrency((seg.accumulatedMs + (i === session.segments.length - 1 && !liveSelectedDevice.activeSession?.isPaused ? (currentTime - session.lastTickTimestamp) : 0)) / (1000 * 60 * 60) * seg.ratePerHour)}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. Prepaid state Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                    <div className="flex items-center justify-between bg-emerald-50/50 p-2 sm:p-3 rounded-xl border border-emerald-100">
                      <div>
                        <span className="text-[11px] sm:text-xs font-bold text-emerald-900 block">تم الدفع مسبقاً للعب</span>
                        <span className="text-[9px] sm:text-[10px] text-emerald-700">لا تحاسبه عليها عند النهاية</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={session.isPlayPrepaid}
                        onChange={() => onTogglePlayPrepaid(liveSelectedDevice.id)}
                        className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-sm border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-teal-50/50 p-2 sm:p-3 rounded-xl border border-teal-100">
                      <div>
                        <span className="text-[11px] sm:text-xs font-bold text-teal-900 block">المنتجات مدفوعة مسبقاً</span>
                        <span className="text-[9px] sm:text-[10px] text-teal-700">إذا دفع ثمنها بشكل مسبق</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={session.isProductsPrepaid}
                        onChange={() => onToggleProductsPrepaid(liveSelectedDevice.id)}
                        className="w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-sm border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* 4. Session Extension controls */}
                  <div className="border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsExtendOpen(!isExtendOpen)}
                      className="w-full flex items-center justify-between bg-indigo-50 hover:bg-indigo-100 text-indigo-900 px-4 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        تمديد وقت الجلسة الحالية
                      </span>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isExtendOpen ? "rotate-90" : ""}`} />
                    </button>

                    {isExtendOpen && (
                      <div className="mt-3 p-3 sm:p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3 animate-fadeIn">
                        <div className="grid grid-cols-4 gap-1 sm:gap-2">
                          {[
                            { value: 15, label: "+15 د" },
                            { value: 30, label: "+30 د" },
                            { value: 60, label: "+1 س" },
                            { value: 120, label: "+2 س" },
                          ].map((x) => (
                            <button
                              key={x.value}
                              type="button"
                              onClick={() => {
                                setIsExtendCustom(false);
                                setIsExtendOpenEnded(false);
                                setExtendMinutes(x.value);
                              }}
                              className={`py-2 rounded-lg text-[10px] sm:text-xs font-semibold transition cursor-pointer border ${
                                !isExtendCustom && !isExtendOpenEnded && extendMinutes === x.value
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              {x.label}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-3 gap-1 sm:gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsExtendCustom(true);
                              setIsExtendOpenEnded(false);
                              setIsExtendByAmount(false);
                            }}
                            className={`py-2 rounded-lg text-[9px] sm:text-xs font-semibold transition cursor-pointer border ${
                              isExtendCustom
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            وقت مخصص
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsExtendCustom(false);
                              setIsExtendOpenEnded(true);
                              setIsExtendByAmount(false);
                            }}
                            className={`py-2 rounded-lg text-[9px] sm:text-xs font-semibold transition cursor-pointer border ${
                              isExtendOpenEnded
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            وقت مفتوح
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsExtendCustom(false);
                              setIsExtendOpenEnded(false);
                              setIsExtendByAmount(true);
                            }}
                            className={`py-2 rounded-lg text-[9px] sm:text-xs font-semibold transition cursor-pointer border ${
                              isExtendByAmount
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            حسب المبلغ
                          </button>
                        </div>

                        {isExtendCustom && (
                          <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                            <span className="text-[10px] sm:text-xs text-gray-500 font-bold shrink-0">دقائق:</span>
                            <input
                              type="number"
                              min="5"
                              value={extendCustomMinutes}
                              onChange={(e) => setExtendCustomMinutes(e.target.value)}
                              className="w-full text-center py-1 border-b border-gray-200 focus:border-indigo-500 outline-hidden font-mono text-sm"
                            />
                          </div>
                        )}

                        {isExtendByAmount && (
                          <div className="bg-white p-2.5 rounded-lg border border-gray-200 space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] sm:text-xs text-gray-500 font-bold shrink-0">المبلغ (ل.س):</span>
                              <input
                                type="text"
                                value={extendAmount}
                                onChange={(e) => setExtendAmount(e.target.value)}
                                className="w-full text-center py-1 border-b border-gray-200 focus:border-indigo-500 outline-hidden font-mono text-sm"
                              />
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono text-center">
                              {Math.round(((parseFloat(extendAmount) || 0) / getHourlyRate(liveSelectedDevice.type, currentPlayersCount, settings)) * 60)} دقيقة
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            if (isExtendOpenEnded) {
                              onExtendSession(liveSelectedDevice.id, 0, true);
                            } else if (isExtendByAmount) {
                              const rate = getHourlyRate(liveSelectedDevice.type, currentPlayersCount, settings);
                              const mins = Math.round(((parseFloat(extendAmount) || 0) / rate) * 60);
                              onExtendSession(liveSelectedDevice.id, mins, false);
                            } else {
                              const mins = isExtendCustom ? parseInt(extendCustomMinutes) || 15 : extendMinutes;
                              onExtendSession(liveSelectedDevice.id, mins, false);
                            }
                            setIsExtendOpen(false);
                            setShowExtendSuccess(true);
                            setTimeout(() => setShowExtendSuccess(false), 3000);
                          }}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer"
                        >
                          تأكيد تمديد الوقت
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 5. Summary and Checkout info */}
                  <div className="bg-gray-900 text-white p-4 sm:p-5 rounded-2xl border border-gray-800 space-y-2 sm:space-y-3 font-sans">
                    <h4 className="text-[10px] sm:text-xs font-bold text-gray-400 border-b border-gray-800 pb-1.5">ملخص الحساب التفصيلي</h4>
                    
                    <div className="flex justify-between text-[11px] sm:text-xs">
                      <span className="text-gray-400">تكلفة اللعب الإجمالية:</span>
                      <span className="font-mono">{formatCurrency(playCost)}</span>
                    </div>
                    {session.isPlayPrepaid && (
                      <div className="flex justify-between text-[11px] sm:text-xs text-emerald-400">
                        <span>(دفع مسبق للعب - خصم):</span>
                        <span className="font-mono">-{formatCurrency(playCost)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-[11px] sm:text-xs mt-1">
                      <span className="text-gray-400">تكلفة المشتريات:</span>
                      <span className="font-mono">{formatCurrency(productsCost)}</span>
                    </div>
                    {productsPaidAmount > 0 && (
                      <div className="flex justify-between text-[11px] sm:text-xs text-emerald-400">
                        <span>(دفع مسبق منتجات - خصم):</span>
                        <span className="font-mono">-{formatCurrency(productsPaidAmount)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-xs sm:text-sm font-bold border-t border-gray-800 pt-2 text-indigo-300">
                      <span>الإجمالي العام:</span>
                      <span className="font-mono text-sm sm:text-base">{formatCurrency(grandTotal)}</span>
                    </div>

                    <div className="flex justify-between text-xs sm:text-sm font-bold bg-white/5 p-2 rounded-lg text-amber-300">
                      <span>الصافي المطلوب تحصيله:</span>
                      <span className="font-mono text-base sm:text-lg">{formatCurrency(Math.max(netCostToPay, 0))}</span>
                    </div>
                  </div>
                </div>

                 {/* Modal Footer */}
                 <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2 justify-between">
                   <div className="flex gap-2">
                     <button
                       type="button"
                       onClick={() => {
                         setShowCancelConfirm(true);
                       }}
                       className="bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition cursor-pointer active:scale-95"
                       id="btn-cancel-session"
                     >
                       إلغاء الجلسة
                     </button>
                   </div>

                   <div className="flex gap-2">
                     <button
                       type="button"
                       onClick={() => setIsDetailsModalOpen(false)}
                       className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl transition cursor-pointer active:scale-95"
                     >
                       إغلاق
                     </button>
                     <button
                       type="button"
                       onClick={() => {
                         setShowCheckoutConfirm(true);
                       }}
                       className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] sm:text-xs font-bold px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 group"
                       id="btn-checkout-session"
                     >
                       <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-100 group-hover:scale-110 transition-transform" />
                       إنهاء ومحاسبة
                     </button>
                   </div>
                 </div>
              </div>
            </div>
          );
        })()
      )}

      {/* CONFIRM PRODUCT DELETION FROM SESSION DIALOG */}
      {productToDelete && (
        <div className="fixed inset-0 bg-gray-950/60 flex items-center justify-center z-55 p-4 animate-fadeIn" id="product-delete-confirm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-right" dir="rtl">
            <h3 className="text-sm font-bold text-gray-900 mb-2">تأكيد حذف المنتج</h3>
            <p className="text-xs text-gray-500 mb-5">هل أنت متأكد من رغبتك في حذف هذا المنتج من الجلسة؟ سيتم إرجاع الكمية المحذوفة إلى المخزون تلقائياً.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveProductFromSession(productToDelete.deviceId, productToDelete.productId);
                  setProductToDelete(null);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                id="btn-confirm-delete-product"
              >
                حذف وتأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END DAY PASSWORD MODAL */}
      {isEndDayModalOpen && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fadeIn" id="end-day-modal">
          <form onSubmit={handleEndDaySubmit} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-rose-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">إقفال الصندوق وإنهاء اليوم المالي</h3>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsEndDayModalOpen(false);
                  setEndDayPassword("");
                  setEndDayError("");
                }}
                className="text-rose-200 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-rose-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-right" dir="rtl">
              <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-rose-900">
                <p className="text-xs font-bold">تحذير مهم قبل الإقفال:</p>
                <p className="text-[11px] text-rose-700 mt-1">
                  سيتم ترحيل كافة العمليات المالية من مبيعات ولعب ومصروفات إلى التقارير التاريخية وتصفير الإحصائيات اليومية للبدء بورديّة جديدة. يجب أن تكون جميع الأجهزة غير نشطة (مغلقة) لإتمام العملية بنجاح.
                </p>
              </div>

              {/* Password field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">أدخل كلمة مرور الوردية للإقفال:</label>
                <input
                  type="password"
                  required
                  placeholder="كلمة المرور الافتراضية 0000"
                  value={endDayPassword}
                  onChange={(e) => setEndDayPassword(e.target.value)}
                  className="w-full text-center border border-gray-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                  id="input-endday-password"
                />
              </div>

              {endDayError && (
                <div className="bg-rose-100 text-rose-800 text-xs p-2.5 rounded-lg font-medium border border-rose-200 text-center animate-bounce">
                  {endDayError}
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEndDayModalOpen(false);
                  setEndDayPassword("");
                  setEndDayError("");
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition cursor-pointer text-center"
              >
                تراجع
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer text-center"
                id="btn-confirm-endday"
              >
                تأكيد إقفال الوردية
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM CANCEL SESSION DIALOG */}
      {showCancelConfirm && liveSelectedDevice && (
        <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-fadeIn" id="session-cancel-confirm">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-right border border-gray-100" dir="rtl">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <h3 className="text-base font-bold text-gray-900 text-center mb-2">تأكيد إلغاء الجلسة بالكامل</h3>
            <p className="text-xs text-gray-500 text-center mb-6 leading-relaxed">
              هل أنت متأكد من إلغاء الجلسة على جهاز <span className="font-bold text-gray-800">{liveSelectedDevice.name}</span>؟ 
              سيتم إرجاع كافة المنتجات المضافة إلى المخزن ولن تسجل أي إيرادات في الصندوق.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold py-2.5 rounded-xl transition cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  onCancelSession(liveSelectedDevice.id);
                  setShowCancelConfirm(false);
                  setIsDetailsModalOpen(false);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-xl transition cursor-pointer"
                id="btn-confirm-cancel-session"
              >
                نعم، إلغاء الجلسة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CHECKOUT SESSION DIALOG */}
      {showCheckoutConfirm && liveSelectedDevice && liveSelectedDevice.activeSession && (
        (() => {
          const session = liveSelectedDevice.activeSession;
          const playCost = calculatePlayCost(session, settings, currentTime);
          const productsCost = session.addedProducts.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
          const grandTotal = playCost + productsCost;
          const prepaidPlayDeduction = session.isPlayPrepaid ? playCost : 0;
          const exactPrepaidProductsCost = session.addedProducts
            .filter(p => p.isPrepaid)
            .reduce((sum, p) => sum + (p.sellPrice * p.quantity), 0);
          const productsPaidAmount = session.isProductsPrepaid ? productsCost : exactPrepaidProductsCost;
          const netCostToPay = grandTotal - prepaidPlayDeduction - productsPaidAmount;

          return (
            <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-xs flex items-center justify-center z-55 p-4 animate-fadeIn" id="session-checkout-confirm">
              <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col" dir="rtl">
                <div className="bg-emerald-900 text-white p-5 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base">فاتورة إنهاء الجلسة والمحاسبة</h3>
                </div>
                <div className="p-6 space-y-4 text-right">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    هل أنت متأكد من إنهاء جلسة <span className="font-bold text-gray-800">{liveSelectedDevice.name}</span> ومحاسبة الزبون <span className="font-bold text-gray-800">{session.customerName}</span>؟
                  </p>
                  
                  <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2.5 font-mono text-xs text-gray-700">
                    <div className="flex justify-between border-b border-gray-200/50 pb-1.5 font-sans font-bold text-gray-900">
                      <span>البند</span>
                      <span>القيمة</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans">تكلفة اللعب:</span>
                      <span>{formatCurrency(playCost)}</span>
                    </div>
                    {session.isPlayPrepaid && (
                      <div className="flex justify-between text-emerald-600">
                        <span className="font-sans">خصم الدفع المسبق (لعب):</span>
                        <span>-{formatCurrency(playCost)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="font-sans">تكلفة المنتجات والمشتريات:</span>
                      <span>{formatCurrency(productsCost)}</span>
                    </div>
                    {productsPaidAmount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span className="font-sans">خصم الدفع المسبق (منتجات):</span>
                        <span>-{formatCurrency(productsPaidAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-sans font-extrabold text-sm border-t border-gray-200 pt-2 text-indigo-700">
                      <span>الإجمالي الصافي المطلوب دفعه:</span>
                      <span className="text-base">{formatCurrency(Math.max(netCostToPay, 0))}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCheckoutConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition cursor-pointer text-center"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onEndSession(liveSelectedDevice.id);
                      setShowCheckoutConfirm(false);
                      setIsDetailsModalOpen(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer text-center"
                    id="btn-confirm-checkout-session"
                  >
                    تأكيد الدفع والإنهاء
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* EXTEND SUCCESS POPUP */}
      {showExtendSuccess && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-xl z-55 flex items-center gap-2 animate-bounce border border-gray-800 text-xs font-bold">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>تم تمديد وقت الجلسة بنجاح!</span>
        </div>
      )}
    </div>
  );
}
