import React, { useState, useRef } from "react";
import { Settings } from "../types";
import { AppState, exportBackup, mergeBackup } from "../utils/store";
import { saveOrShareFile } from "../utils/exportReports";
import { ensureSyncPermissions, startNearbySync, stopNearbySync, SyncStatusEvent, SyncDataEvent } from "../utils/nearbySync";
import { 
  Settings as SettingsIcon, 
  DollarSign, 
  Volume2, 
  Play, 
  Download, 
  Upload, 
  Save, 
  CheckCircle, 
  Smartphone, 
  Laptop, 
  Wifi, 
  HelpCircle,
  VolumeX,
  FileText,
  Moon,
  Loader2,
  Bluetooth,
  X
} from "lucide-react";
import { playAlertTone } from "../utils/calculations";
import { saveCustomDeviceSound, hasCustomDeviceSound, CUSTOM_SOUND_KEY } from "../utils/notifications";

interface SettingsViewProps {
  settings: Settings;
  onSaveSettings: (settings: Settings) => void;
  onToggleDarkMode: (value: boolean) => void;
  fullState: any; // complete state to backup
  onImportState: (importedState: any) => void;
}

export default function SettingsView({
  settings,
  onSaveSettings,
  onToggleDarkMode,
  fullState,
  onImportState,
}: SettingsViewProps) {
  // Local form states
  const [ps4Rate1_2, setPs4Rate1_2] = useState(settings.ps4Rate1_2.toString());
  const [ps4Rate3, setPs4Rate3] = useState(settings.ps4Rate3.toString());
  const [ps4Rate4, setPs4Rate4] = useState(settings.ps4Rate4.toString());
  const [pcRate1, setPcRate1] = useState(settings.pcRate1.toString());
  const [pcRate2, setPcRate2] = useState(settings.pcRate2.toString());
  const [pcRate3_4, setPcRate3_4] = useState(settings.pcRate3_4.toString());

  const [soundAlertName, setSoundAlertName] = useState(settings.soundAlertName);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [soundVolume, setSoundVolume] = useState(settings.soundVolume);
  const [customSoundStatus, setCustomSoundStatus] = useState<"idle" | "saving" | "saved" | "error">(
    hasCustomDeviceSound() ? "saved" : "idle"
  );

  // Offers local states
  const [ps4OffersEnabled, setPs4OffersEnabled] = useState(settings.ps4OffersEnabled ?? false);
  const [ps4OffersStart, setPs4OffersStart] = useState(settings.ps4OffersStart ?? "12:00");
  const [ps4OffersEnd, setPs4OffersEnd] = useState(settings.ps4OffersEnd ?? "17:00");
  const [ps4OffersRate1_2, setPs4OffersRate1_2] = useState((settings.ps4OffersRate1_2 ?? 1.5).toString());
  const [ps4OffersRate3, setPs4OffersRate3] = useState((settings.ps4OffersRate3 ?? 2.5).toString());
  const [ps4OffersRate4, setPs4OffersRate4] = useState((settings.ps4OffersRate4 ?? 3.5).toString());

  const [pcOffersEnabled, setPcOffersEnabled] = useState(settings.pcOffersEnabled ?? false);
  const [pcOffersStart, setPcOffersStart] = useState(settings.pcOffersStart ?? "12:00");
  const [pcOffersEnd, setPcOffersEnd] = useState(settings.pcOffersEnd ?? "17:00");
  const [pcOffersRate1, setPcOffersRate1] = useState((settings.pcOffersRate1 ?? 1.0).toString());
  const [pcOffersRate2, setPcOffersRate2] = useState((settings.pcOffersRate2 ?? 1.5).toString());
  const [pcOffersRate3_4, setPcOffersRate3_4] = useState((settings.pcOffersRate3_4 ?? 2.5).toString());

  const [darkMode, setDarkMode] = useState(settings.darkMode ?? false);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ps4Rate1_2: parseFloat(ps4Rate1_2) || 2.0,
      ps4Rate3: parseFloat(ps4Rate3) || 3.0,
      ps4Rate4: parseFloat(ps4Rate4) || 4.0,
      pcRate1: parseFloat(pcRate1) || 1.5,
      pcRate2: parseFloat(pcRate2) || 2.0,
      pcRate3_4: parseFloat(pcRate3_4) || 3.0,
      soundAlertName,
      soundEnabled,
      soundVolume,

      ps4OffersEnabled,
      ps4OffersStart,
      ps4OffersEnd,
      ps4OffersRate1_2: parseFloat(ps4OffersRate1_2) || 1.5,
      ps4OffersRate3: parseFloat(ps4OffersRate3) || 2.5,
      ps4OffersRate4: parseFloat(ps4OffersRate4) || 3.5,

      pcOffersEnabled,
      pcOffersStart,
      pcOffersEnd,
      pcOffersRate1: parseFloat(pcOffersRate1) || 1.0,
      pcOffersRate2: parseFloat(pcOffersRate2) || 1.5,
      pcOffersRate3_4: parseFloat(pcOffersRate3_4) || 2.5,

      darkMode,
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleTestTone = () => {
    playAlertTone(soundAlertName, soundVolume);
  };

  const handleCustomSoundPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setCustomSoundStatus("saving");
    const success = await saveCustomDeviceSound(file);
    setCustomSoundStatus(success ? "saved" : "error");
    e.target.value = "";
  };

  // Export database
  const [isExportingDB, setIsExportingDB] = useState(false);
  const handleExportDB = async () => {
    if (isExportingDB) return;
    setIsExportingDB(true);
    try {
      const backupJson = exportBackup(fullState);
      const base64 = btoa(unescape(encodeURIComponent(backupJson)));

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, "0");
      const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const fileName = `MrGamer-Backup-${dateStr}_${timeStr}.json`;

      await saveOrShareFile(base64, fileName, "application/json");
    } catch (error) {
      console.error("Export failed:", error);
      alert("تعذّر تصدير النسخة الاحتياطية، حاول مرة أخرى.");
    } finally {
      setIsExportingDB(false);
    }
  };

  // Import database (Always merges safely)
  const handleImportDB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    fileReader.onload = (event) => {
      const resultString = event.target?.result as string;
      if (!resultString) return;

      const result = mergeBackup(resultString, fullState, true);

      if (!result.success) {
        alert(result.error || "ملف النسخة الاحتياطية غير صالح أو معطوب!");
        return;
      }

      onImportState(result.mergedState);
      alert("تم دمج واستيراد البيانات بنجاح!");
      window.location.reload();
    };
    fileReader.readAsText(files[0]);
  };

  // Direct device-to-device sync
  const [isNearbySyncing, setIsNearbySyncing] = useState(false);
  const [nearbySyncMsg, setNearbySyncMsg] = useState("");
  const nearbySyncCleanupRef = useRef<(() => void) | null>(null);

  const handleStopNearbySync = async (finalMessage?: string) => {
    if (nearbySyncCleanupRef.current) {
      await nearbySyncCleanupRef.current();
      nearbySyncCleanupRef.current = null;
    }
    if (finalMessage) {
      setNearbySyncMsg(finalMessage);
      setTimeout(() => {
        setIsNearbySyncing(false);
        setNearbySyncMsg("");
      }, 2000);
    } else {
      setIsNearbySyncing(false);
      setNearbySyncMsg("");
    }
  };

  const handleStartNearbySync = async () => {
    const granted = await ensureSyncPermissions();
    if (!granted) {
      alert("لازم توافق على صلاحيات البلوتوث/الاتصال القريب لتشغيل هذه الميزة.");
      return;
    }

    setIsNearbySyncing(true);
    setNearbySyncMsg("جاري البحث عن جهاز قريب... تأكد أن الموظف الآخر ضغط نفس الزر على جهازه.");

    // نضمن إرسال أحدث نسخة بيانات حية حالياً
    const backupJson = exportBackup(fullState);

    const handleStatus = (event: SyncStatusEvent) => {
      setNearbySyncMsg(event.message);
      if (event.status === "error") {
        handleStopNearbySync(event.message);
      }
    };

    const handleDataReceived = (event: SyncDataEvent) => {
      // دمج تلقائي مباشر وذكي دائماً لجميع السجلات والمصاريف والأجهزة
      const result = mergeBackup(event.data, fullState, true);

      if (!result.success) {
        handleStopNearbySync(result.error || "تعذّر دمج البيانات المستلمة.");
        return;
      }

      // تحديث واجهة التطبيق بالبيانات المدمجة مباشرة بدون اعتراض
      onImportState(result.mergedState);

      handleStopNearbySync("تمت المزامنة والدمج بنجاح ✅");
      setTimeout(() => window.location.reload(), 1500);
    };

    const cleanup = await startNearbySync("MrGamer", backupJson, handleStatus, handleDataReceived);
    nearbySyncCleanupRef.current = cleanup;
  };

  return (
    <div className="space-y-6" id="settings-view">
      
      {/* Settings title card */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
          إعدادات النظام وأسعار الصالة
        </h2>
        <p className="text-xs text-gray-500 mt-1">اضبط لوائح تسعير الألعاب لكل ساعة، ونغمات التنبيه للأجهزة، وأدوات النقل اليدوي</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" dir="rtl">
        {/* Main pricing settings form */}
        <form onSubmit={handleSave} className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 space-y-6 shadow-xs">
          <h3 className="text-sm font-bold text-gray-900 border-b border-gray-50 pb-3">إعداد تسعيرة ساعات الألعاب</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* PlayStation rates */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md block w-fit">أجهزة البلايستيشن PS4</span>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">سعر الساعة (لاعب أو لاعبين) ل.س:</label>
                <input
                  type="text"
                  required
                  value={ps4Rate1_2}
                  onChange={(e) => setPs4Rate1_2(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">سعر الساعة (3 لاعبين) ل.س:</label>
                <input
                  type="text"
                  required
                  value={ps4Rate3}
                  onChange={(e) => setPs4Rate3(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">سعر الساعة (4 لاعبين) ل.س:</label>
                <input
                  type="text"
                  required
                  value={ps4Rate4}
                  onChange={(e) => setPs4Rate4(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>
            </div>

            {/* PC rates */}
            <div className="space-y-4">
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md block w-fit">أجهزة الكومبيوتر PC</span>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">سعر الساعة (لاعب واحد) ل.س:</label>
                <input
                  type="text"
                  required
                  value={pcRate1}
                  onChange={(e) => setPcRate1(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">سعر الساعة (لاعبين) ل.س:</label>
                <input
                  type="text"
                  required
                  value={pcRate2}
                  onChange={(e) => setPcRate2(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-600 block">سعر الساعة (3-4 لاعبين) ل.س:</label>
                <input
                  type="text"
                  required
                  value={pcRate3_4}
                  onChange={(e) => setPcRate3_4(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>
            </div>

          </div>

          {/* Offers & Discount period settings */}
          <div className="border-t border-gray-50 pt-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center font-bold">🎁</span>
              إعداد عروض الصالة وفترات الخصم (سعر أقل في ساعات معينة)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* PlayStation Offers */}
              <div className="space-y-4 bg-indigo-50/20 p-4 rounded-2xl border border-indigo-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-100/60 px-2.5 py-1 rounded-md block w-fit">عروض البلايستيشن PS4</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ps4OffersEnabled}
                      onChange={(e) => setPs4OffersEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    <span className="mr-2 text-xs font-bold text-gray-700 mr-2">تفعيل العرض</span>
                  </label>
                </div>

                {ps4OffersEnabled && (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 block">وقت البدء (من):</label>
                        <input
                          type="time"
                          value={ps4OffersStart}
                          onChange={(e) => setPs4OffersStart(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 block">وقت الانتهاء (إلى):</label>
                        <input
                          type="time"
                          value={ps4OffersEnd}
                          onChange={(e) => setPs4OffersEnd(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-indigo-100/40 pt-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 block">سعر الساعة بالعرض (لاعب أو لاعبين):</label>
                        <input
                          type="text"
                          value={ps4OffersRate1_2}
                          onChange={(e) => setPs4OffersRate1_2(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 block">سعر الساعة بالعرض (3 لاعبين):</label>
                        <input
                          type="text"
                          value={ps4OffersRate3}
                          onChange={(e) => setPs4OffersRate3(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 block">سعر الساعة بالعرض (4 لاعبين):</label>
                        <input
                          type="text"
                          value={ps4OffersRate4}
                          onChange={(e) => setPs4OffersRate4(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PC Offers */}
              <div className="space-y-4 bg-teal-50/20 p-4 rounded-2xl border border-teal-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-700 bg-teal-100/60 px-2.5 py-1 rounded-md block w-fit">عروض أجهزة الكومبيوتر PC</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pcOffersEnabled}
                      onChange={(e) => setPcOffersEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                    <span className="mr-2 text-xs font-bold text-gray-700 mr-2">تفعيل العرض</span>
                  </label>
                </div>

                {pcOffersEnabled && (
                  <div className="space-y-3.5 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 block">وقت البدء (من):</label>
                        <input
                          type="time"
                          value={pcOffersStart}
                          onChange={(e) => setPcOffersStart(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 block">وقت الانتهاء (إلى):</label>
                        <input
                          type="time"
                          value={pcOffersEnd}
                          onChange={(e) => setPcOffersEnd(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-teal-100/40 pt-2.5">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 block">سعر الساعة بالعرض (لاعب واحد):</label>
                        <input
                          type="text"
                          value={pcOffersRate1}
                          onChange={(e) => setPcOffersRate1(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 block">سعر الساعة بالعرض (لاعبين):</label>
                        <input
                          type="text"
                          value={pcOffersRate2}
                          onChange={(e) => setPcOffersRate2(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-600 block">سعر الساعة بالعرض (3-4 لاعبين):</label>
                        <input
                          type="text"
                          value={pcOffersRate3_4}
                          onChange={(e) => setPcOffersRate3_4(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-hidden font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sound & Alert tone settings */}
          <div className="border-t border-gray-50 pt-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Volume2 className="w-4.5 h-4.5 text-gray-500" />
              تنبيهات انتهاء وقت الجلسة
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 block">نغمة التنبيه الافتراضية:</label>
                <select
                  value={soundAlertName}
                  onChange={(e) => setSoundAlertName(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-xs bg-white cursor-pointer font-sans"
                >
                  <option value="retro_arcade">نغمة أركيد سريعة (Retro Arcade)</option>
                  <option value="high_pitch">منبه متقطع حاد (Alarm Tone)</option>
                  <option value="soft_chime">جرس هادئ دافئ (Soft Chime)</option>
                  <option value="double_beep">رنين ثنائي هادئ (Double Beep)</option>
                  <option value={CUSTOM_SOUND_KEY}>🎵 نغمة من جهازي...</option>
                </select>

                {soundAlertName === CUSTOM_SOUND_KEY && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                    <div className="relative">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleCustomSoundPick}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        id="custom-sound-input"
                      />
                      <button
                        type="button"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg transition flex items-center justify-center gap-1.5 pointer-events-none"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {customSoundStatus === "saving" ? "جاري الحفظ..." : "اختيار ملف صوت من الجهاز"}
                      </button>
                    </div>
                    {customSoundStatus === "saved" && (
                      <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        تم حفظ النغمة المخصصة بنجاح، وستُستخدم في الإشعارات القادمة.
                      </p>
                    )}
                    {customSoundStatus === "error" && (
                      <p className="text-[11px] text-red-600">تعذّر حفظ الملف، جرّب ملفاً آخر (mp3/wav).</p>
                    )}
                    <p className="text-[10px] text-gray-500">
                      ملاحظة: اختيار ملف جديد لاحقاً سيستبدل النغمة المحفوظة حالياً.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-600 block">مستوى صوت النغمة والتحكم:</label>
                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
                  <button
                    type="button"
                    onClick={handleTestTone}
                    disabled={soundAlertName === CUSTOM_SOUND_KEY}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2 rounded-lg transition text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Play className="w-3.5 h-3.5" />
                    تجربة النغمة
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={soundVolume}
                    onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <span className="font-mono text-xs font-bold w-6 shrink-0">{Math.round(soundVolume * 100)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dark Mode Theme Setting */}
          <div className="border-t border-gray-50 pt-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Moon className="w-4.5 h-4.5 text-gray-500" />
              مظهر التطبيق (الوضع الليلي)
            </h3>

            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
              <div className="space-y-0.5 text-right">
                <span className="text-xs font-bold text-gray-800 block">تفعيل الوضع الليلي (Dark Mode)</span>
                <span className="text-[10px] text-gray-500 block">تغيير واجهات النظام إلى الألوان الداكنة لحماية العين والراحة عند الاستخدام ليلاً.</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={(e) => {
                    setDarkMode(e.target.checked);
                    onToggleDarkMode(e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-50 pt-4 flex justify-between items-center">
            {saveSuccess && (
              <div className="text-emerald-700 text-xs font-bold flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 animate-pulse">
                <CheckCircle className="w-4 h-4" />
                تم حفظ وتحديث أسعار الصالة بنجاح!
              </div>
            )}
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer ml-auto"
            >
              <Save className="w-4 h-4" />
              حفظ أسعار الصالة والمنبه
            </button>
          </div>
        </form>

        {/* Offline collaboration & Backups */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-indigo-900 border-b border-indigo-50 pb-3 flex items-center gap-1.5">
              <Wifi className="w-4.5 h-4.5 text-indigo-600" />
              المزامنة والنسخ الاحتياطي (الأوفلاين)
            </h3>

            <div className="space-y-3.5 text-xs text-gray-600 leading-relaxed">
              <p>
                بما أن البرنامج يعمل بوضع <strong>الأوفلاين الكامل</strong> وبدون راوتر متصل بالإنترنت:
              </p>
              
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200/50 space-y-2">
                <div className="flex gap-2 items-start">
                  <Smartphone className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-[11px]">
                    <strong>التنسيق بين موظفي المحل:</strong> يمكن للموظف الأول الضغط على زر "مزامنة مباشرة" وإرسالها مباشرة للموظف الثاني بدون أي إنترنت.
                  </p>
                </div>
                <div className="flex gap-2 items-start border-t border-gray-100 pt-2">
                  <Laptop className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-[11px]">
                    <strong>تحديث البيانات الذكي:</strong> تتطابق بيانات الجوالين تلقائياً وترتّب السجلات والمصاريف الجديدة دائماً وبأمان تام.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 border-t border-gray-50 pt-4">
            {/* Direct Nearby Sync - primary option */}
            {!isNearbySyncing ? (
              <button
                onClick={handleStartNearbySync}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Bluetooth className="w-4 h-4" />
                مزامنة مباشرة الآن (بدون ملفات)
              </button>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-emerald-700 animate-spin shrink-0" />
                  <p className="text-[11px] font-bold text-emerald-800 leading-relaxed">{nearbySyncMsg}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleStopNearbySync()}
                  className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 py-1.5 rounded-lg transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  إلغاء المزامنة
                </button>
              </div>
            )}
            <p className="text-[10px] text-gray-400 text-center leading-relaxed">
              اضغط الموظفان الزر بنفس الوقت على الجهازين وهما قريبان من بعض، وبتتم المزامنة تلقائياً خلال ثوانٍ.
            </p>

            <div className="border-t border-gray-100 pt-2.5">
              <p className="text-[10px] text-gray-400 text-center mb-2">أو كطريقة احتياطية (لو تعذّر الاتصال المباشر):</p>
            </div>

            {/* Export DB Button */}
            <button
              onClick={handleExportDB}
              disabled={isExportingDB}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExportingDB ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-emerald-400" />
              )}
              مشاركة نسخة احتياطية (بلوتوث / قريب مني)
            </button>

            {/* Import DB Button */}
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImportDB}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="db-file-input"
              />
              <button
                type="button"
                className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 pointer-events-none"
              >
                <Upload className="w-4 h-4" />
                استيراد نسخة احتياطية (رفع ملف البيانات)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
