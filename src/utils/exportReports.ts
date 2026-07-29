import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export interface ExportDeviceStat {
  name: string;
  duration: number;
  revenue: number;
}

export interface ExportProductStat {
  name: string;
  qty: number;
  revenue: number;
}

export interface ReportExportData {
  periodLabel: string;
  generatedAt: string;
  totalPlayRevenue: number;
  totalProductRevenue: number;
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMarginPercent: number;
  devices: ExportDeviceStat[];
  products: ExportProductStat[];
}

/**
 * يحفظ ملفاً (Excel أو PDF) على الجهاز. على أندرويد (تطبيق Capacitor) يتم
 * حفظه بمساحة التخزين الخاصة بالتطبيق ثم فتح قائمة "مشاركة" النظام حتى
 * يختار المستخدم أين يريد حفظه (الملفات، درايف، واتساب...).
 * على المتصفح العادي (أثناء التطوير) يتم تنزيله مباشرة كملف تحميل عادي.
 */
async function saveOrShareFile(base64Data: string, fileName: string, mimeType: string) {
  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache
    });

    try {
      // محاولة فتح الملف مباشرة
      const { FileOpener } = await import("@capacitor-community/file-opener");
      await FileOpener.open({
        filePath: result.uri,
        contentType: mimeType
      });
    } catch (e) {
      // في حال فشل الفتح (مثلاً لا يوجد تطبيق يدعم الصيغة)، نعود لخيار المشاركة
      await Share.share({
        title: fileName,
        url: result.uri
      });
    }
  } else {
    const link = document.createElement("a");
    link.href = `data:${mimeType};base64,${base64Data}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * تصدير التقرير كملف Excel حقيقي (بيانات فعلية قابلة للتعديل، وليس صورة).
 * النص العربي يُخزَّن بترميز UTF-8 القياسي داخل ملف xlsx، فلا حاجة لأي معالجة خاصة.
 */
export async function exportReportToExcel(data: ReportExportData, fileNamePrefix: string = "تقرير-ماركامر") {
  const XLSX = await import("xlsx");

  // ---- ورقة 1: الملخص المالي ----
  const summarySheetData = [
    ["تقرير Mr.Gamer المالي"],
    [`الفترة: ${data.periodLabel}`],
    [`تاريخ الإصدار: ${data.generatedAt}`],
    [],
    ["البند", "المبلغ (ل.س)"],
    ["إيرادات الألعاب", data.totalPlayRevenue],
    ["إيرادات المنتجات", data.totalProductRevenue],
    ["إجمالي الدخل", data.grossRevenue],
    ["إجمالي المصاريف والمشتريات", data.totalExpenses],
    ["صافي الأرباح", data.netProfit],
    ["نسبة الربح الإجمالية (%)", data.profitMarginPercent]
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData);
  summarySheet["!cols"] = [{ wch: 30 }, { wch: 18 }];

  // ---- ورقة 2: أداء الأجهزة ----
  const devicesSheetData = [
    ["اسم الجهاز", "الوقت الكلي الملعوب (دقيقة)", "الإيراد (ل.س)"],
    ...data.devices.map(d => [d.name, Math.round(d.duration), d.revenue])
  ];
  const devicesSheet = XLSX.utils.aoa_to_sheet(devicesSheetData);
  devicesSheet["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 16 }];

  // ---- ورقة 3: المنتجات الأكثر مبيعاً ----
  const productsSheetData = [
    ["اسم المنتج", "الكمية المباعة", "إجمالي المبيع (ل.س)"],
    ...data.products.map(p => [p.name, p.qty, p.revenue])
  ];
  const productsSheet = XLSX.utils.aoa_to_sheet(productsSheetData);
  productsSheet["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 18 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "الملخص المالي");
  XLSX.utils.book_append_sheet(workbook, devicesSheet, "أداء الأجهزة");
  XLSX.utils.book_append_sheet(workbook, productsSheet, "المنتجات الأكثر مبيعاً");

  const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
  const fileName = `${fileNamePrefix}-${Date.now()}.xlsx`;
  await saveOrShareFile(
    base64,
    fileName,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
}

/**
 * تصدير التقرير كملف PDF. لتفادي مشاكل تشوّه الحروف العربية المعروفة في
 * مكتبات PDF (مثل jsPDF عند رسم النص مباشرة)، يتم "تصوير" قالب HTML نظيف
 * (نفس محرك عرض الموبايل الذي يعرض العربية بشكل صحيح تماماً) كصورة عالية
 * الدقة، ثم وضع هذه الصورة داخل ملف PDF مع دعم صفحات متعددة عند الحاجة.
 */
export async function exportReportToPdf(elementId: string, fileNamePrefix: string = "تقرير-ماركامر") {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Printable report template not found");

  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
    onclone: (clonedDoc) => {
      // إزالة فئة الوضع الليلي من النسخة المستنسخة لضمان التقاط الألوان الأصلية
      clonedDoc.documentElement.classList.remove("dark");
      const template = clonedDoc.getElementById(elementId);
      if (template) {
        template.style.color = "#000000";
      }
    }
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const base64 = pdf.output("datauristring").split(",")[1];
  const fileName = `${fileNamePrefix}-${Date.now()}.pdf`;
  await saveOrShareFile(base64, fileName, "application/pdf");
}
