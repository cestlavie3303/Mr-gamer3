import React, { useState } from "react";
import { Product, Expense, Settings } from "../types";
import { 
  Package, 
  Plus, 
  Trash2, 
  Edit, 
  TrendingDown, 
  Layers, 
  CheckCircle, 
  AlertTriangle, 
  Tag, 
  FileText, 
  DollarSign, 
  ShoppingBag, 
  ArrowDownCircle, 
  PlusCircle, 
  X,
  Sparkles,
  RefreshCw,
  Search
} from "lucide-react";
import { formatCurrency } from "../utils/calculations";

interface ExpensesViewProps {
  products: Product[];
  expenses: Expense[];
  shiftDate: string;
  onAddProduct: (product: Omit<Product, "id">) => void;
  onEditProduct: (id: string, product: Partial<Product>) => void;
  onDeleteProduct: (id: string) => void;
  onRestockProduct: (id: string, quantity: number, customBuyPrice?: number) => void;
  onDirectSale: (id: string, quantity: number) => boolean;
  onAddExpense: (expense: Omit<Expense, "id" | "timestamp">) => void;
}

export default function ExpensesView({
  products,
  expenses,
  shiftDate,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onRestockProduct,
  onDirectSale,
  onAddExpense,
}: ExpensesViewProps) {
  // Tabs for sub-views
  const [activeTab, setActiveTab] = useState<"inventory" | "expenses">("inventory");

  // Modal states
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [isDirectSaleOpen, setIsDirectSaleOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Form fields for Products
  const [pName, setPName] = useState("");
  const [pBuyPrice, setPBuyPrice] = useState("");
  const [pSellPrice, setPSellPrice] = useState("");
  const [pStock, setPStock] = useState("");
  const [pMinAlert, setPMinAlert] = useState("");

  // Select target product for edit/restock/sale
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actionQty, setActionQty] = useState<string>("");
  const [customRestockPrice, setCustomRestockPrice] = useState<string>("");

  // Form fields for Expenses
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCat, setExpCat] = useState<Expense["category"]>("fawateer");

  // Filter products by stock low warning
  const [productSearch, setSearchTerm] = useState("");

  const handleOpenAddProduct = () => {
    setPName("");
    setPBuyPrice("");
    setPSellPrice("");
    setPStock("");
    setPMinAlert("");
    setIsAddProductOpen(true);
  };

  const handleAddProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pName.trim()) return;

    onAddProduct({
      name: pName.trim(),
      buyPrice: parseFloat(pBuyPrice) || 0,
      sellPrice: parseFloat(pSellPrice) || 0,
      currentStock: parseInt(pStock) || 0,
      minStockThreshold: parseInt(pMinAlert) || 0,
    });
    setIsAddProductOpen(false);
  };

  const handleOpenEditProduct = (p: Product) => {
    setSelectedProduct(p);
    setPName(p.name);
    setPBuyPrice(p.buyPrice.toString());
    setPSellPrice(p.sellPrice.toString());
    setPMinAlert(p.minStockThreshold.toString());
    setIsEditProductOpen(true);
  };

  const handleEditProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !pName.trim()) return;

    onEditProduct(selectedProduct.id, {
      name: pName.trim(),
      buyPrice: parseFloat(pBuyPrice) || 0,
      sellPrice: parseFloat(pSellPrice) || 0,
      minStockThreshold: parseInt(pMinAlert) || 0,
    });
    setIsEditProductOpen(false);
  };

  const handleOpenRestock = (p: Product) => {
    setSelectedProduct(p);
    setActionQty("");
    setCustomRestockPrice(p.buyPrice.toString());
    setIsRestockOpen(true);
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qtyNum = parseInt(actionQty) || 0;
    const restockBuyPrice = parseFloat(customRestockPrice) || selectedProduct.buyPrice;
    onRestockProduct(selectedProduct.id, qtyNum, restockBuyPrice);
    setIsRestockOpen(false);
    alert(`تم توريد كمية إضافية (${qtyNum} حبة) لمنتج ${selectedProduct.name} بنجاح!`);
  };

  const handleOpenDirectSale = (p: Product) => {
    setSelectedProduct(p);
    setActionQty("");
    setIsDirectSaleOpen(true);
  };

  const handleDirectSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const qtyNum = parseInt(actionQty) || 0;
    if (qtyNum > selectedProduct.currentStock) {
      alert("الكمية المطلوبة أكبر من المتوفر في المخزن!");
      return;
    }

    const success = onDirectSale(selectedProduct.id, qtyNum);
    if (success) {
      setIsDirectSaleOpen(false);
      alert(`تم بيع ${qtyNum} حبة من ${selectedProduct.name} نقداً بنجاح!`);
    }
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc.trim() || !expAmount) return;

    onAddExpense({
      description: expDesc.trim(),
      amount: parseFloat(expAmount) || 0,
      category: expCat,
      date: shiftDate,
    });

    setIsAddExpenseOpen(false);
    setExpDesc("");
    setExpAmount("");
    alert("تم تسجيل المصروف بنجاح وترحيله للوردية!");
  };

  // Filter products list
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="space-y-6" id="inventory-view">
      {/* Header View */}
      <div className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-600" />
            إدارة المخزن والمشتريات والمصروفات
          </h2>
          <p className="text-xs text-gray-500 mt-1">تابع كميات المنتجات المتوفرة وقم بتسجيل مبيعات الكاش أو فواتير المحل</p>
        </div>

        {/* Tab Controls */}
        <div className="bg-gray-100 p-1.5 rounded-xl flex gap-1 self-start" dir="rtl">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "inventory" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            المخزن والمبيعات
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === "expenses" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            المصروفات والفواتير
          </button>
        </div>
      </div>

      {activeTab === "inventory" ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Actions grid for warehouse */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-100">
            <div className="relative flex-1 max-w-sm" dir="rtl">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="ابحث عن منتج بالمخزن ..."
                value={productSearch}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl pr-9 pl-3 py-2 text-xs text-gray-800 outline-hidden font-sans w-full"
              />
            </div>

            <button
              onClick={handleOpenAddProduct}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-1 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              إضافة منتج جديد للمستودع
            </button>
          </div>

          {/* Grid list of Products */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" dir="rtl">
            {filteredProducts.map((p) => {
              const isLowStock = p.currentStock <= p.minStockThreshold;
              return (
                <div 
                  key={p.id}
                  className={`bg-white rounded-2xl border p-4 flex flex-col justify-between transition-all duration-300 ${
                    p.currentStock === 0
                      ? "border-rose-300 bg-rose-50/10"
                      : isLowStock
                      ? "border-amber-300 bg-amber-50/10"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">{p.name}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm block mt-1 w-fit ${
                          p.currentStock === 0
                            ? "bg-rose-100 text-rose-800"
                            : isLowStock
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {p.currentStock === 0 ? "نفذ بالكامل" : isLowStock ? "مخزون منخفض" : "متوفر بالمستودع"}
                        </span>
                      </div>

                      {/* Options drop */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleOpenEditProduct(p)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                          title="تعديل التسعيرة"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`هل أنت متأكد من حذف المنتج ${p.name} نهائياً من الصالة؟`)) {
                              onDeleteProduct(p.id);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-gray-50 rounded-lg transition cursor-pointer"
                          title="حذف منتج"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stock indicator bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold">المخزون المتوفر:</span>
                        <span className="font-mono font-bold text-gray-800">{p.currentStock} حبة</span>
                      </div>
                      <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            p.currentStock === 0 ? "bg-rose-600" : isLowStock ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min((p.currentStock / 50) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-gray-400 block">حد التنبيه الأدنى: {p.minStockThreshold} حبة</span>
                    </div>

                    {/* Financial details inside card */}
                    <div className="grid grid-cols-2 gap-2 text-center py-1 font-mono text-[11px] border-t border-b border-gray-50 mt-2">
                      <div className="p-1.5 bg-gray-50 rounded-lg">
                        <span className="text-gray-400 text-[10px] block font-sans">سعر الشراء</span>
                        <span className="text-gray-700 font-bold">{formatCurrency(p.buyPrice)}</span>
                      </div>
                      <div className="p-1.5 bg-indigo-50/40 rounded-lg">
                        <span className="text-indigo-500 text-[10px] block font-sans">سعر المبيع</span>
                        <span className="text-indigo-700 font-bold">{formatCurrency(p.sellPrice)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Operational controls for product */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenDirectSale(p)}
                      disabled={p.currentStock <= 0}
                      className="py-2 bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                      بيع مباشر كاش
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenRestock(p)}
                      className="py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 rounded-xl text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      شراء وتوريد كميات
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn" dir="rtl">
          {/* List of custom expenses */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-50">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <FileText className="w-4.5 h-4.5 text-gray-500" />
                سجل كافة المصروفات للوردية الحالية
              </h3>
              <button
                onClick={() => setIsAddExpenseOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                تسجيل مصروف جديد
              </button>
            </div>

            {expenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-gray-50 text-gray-600 font-bold">
                    <tr>
                      <th className="p-3">المصروف / الوصف</th>
                      <th className="p-3 text-center">التصنيف</th>
                      <th className="p-3 text-center">التاريخ والوقت</th>
                      <th className="p-3 text-center">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-800">{exp.description}</td>
                        <td className="p-3 text-center">
                          <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-sm text-[10px] font-bold">
                            {exp.category === "fawateer" ? "سداد فواتير" : exp.category === "purchases" ? "شراء منتجات" : exp.category === "maintenance" ? "صيانة المحل" : "أخرى"}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-gray-500">
                          {new Date(exp.timestamp).toLocaleTimeString("ar-JO", { hour: "2-digit", minute: "2-digit" })} | {exp.date}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-rose-600">{formatCurrency(exp.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-400 text-xs py-10">لا توجد مصروفات مسجلة للوردية المفتوحة حالياً.</p>
            )}
          </div>

          {/* Quick Expense stats summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-50 pb-3 flex items-center gap-1.5">
              <ArrowDownCircle className="w-4.5 h-4.5 text-rose-500" />
              ملخص المصروفات
            </h3>

            <div className="space-y-3.5">
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
                <span className="text-[10px] text-rose-800 font-bold block mb-1">مجموع الفواتير والمصروفات</span>
                <span className="font-mono text-xl font-bold text-rose-600">
                  {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <span className="font-bold text-gray-700 block">تفصيل حسب الفئة:</span>
                {[
                  { key: "fawateer", label: "فواتير كهرباء وإنترنت وهاتف" },
                  { key: "purchases", label: "شراء وتوريد منتجات للمستودع" },
                  { key: "maintenance", label: "صيانة أجهزة ومعدات" },
                  { key: "other", label: "مصاريف عامة أخرى" },
                ].map((cat) => {
                  const amount = expenses.filter(e => e.category === cat.key).reduce((sum, e) => sum + e.amount, 0);
                  return (
                    <div key={cat.key} className="flex justify-between items-center py-1 border-b border-gray-100/40">
                      <span className="text-gray-500">{cat.label}</span>
                      <span className="font-mono text-gray-800 font-bold">{formatCurrency(amount)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {isAddProductOpen && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fadeIn" id="add-product-modal">
          <form onSubmit={handleAddProductSubmit} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-gray-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">إضافة منتج جديد للمستودع</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="text-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-right" dir="rtl">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">اسم المنتج:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: علبة بيبسي، قهوة تركي، شيبس ليز..."
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">سعر الشراء (ل.س):</label>
                  <input
                    type="text"
                    required
                    value={pBuyPrice}
                    onChange={(e) => setPBuyPrice(e.target.value)}
                    className="w-full border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">سعر مبيع الزبون (ل.س):</label>
                  <input
                    type="text"
                    required
                    value={pSellPrice}
                    onChange={(e) => setPSellPrice(e.target.value)}
                    className="w-full border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">الكمية الابتدائية بالمخزن:</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={pStock}
                    onChange={(e) => setPStock(e.target.value)}
                    className="w-full border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">حد التنبيه الأدنى للطلب:</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={pMinAlert}
                    onChange={(e) => setPMinAlert(e.target.value)}
                    className="w-full border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition cursor-pointer text-center"
              >
                تراجع
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-900 hover:bg-gray-800 text-white transition cursor-pointer text-center"
              >
                حفظ المنتج بالمستودع
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EDIT PRODUCT PRICING MODAL */}
      {isEditProductOpen && selectedProduct && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fadeIn" id="edit-product-modal">
          <form onSubmit={handleEditProductSubmit} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-gray-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">تعديل المنتج: {selectedProduct.name}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsEditProductOpen(false)}
                className="text-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-right" dir="rtl">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">اسم المنتج:</label>
                <input
                  type="text"
                  required
                  value={pName}
                  onChange={(e) => setPName(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">سعر الشراء (ل.س):</label>
                  <input
                    type="text"
                    required
                    value={pBuyPrice}
                    onChange={(e) => setPBuyPrice(e.target.value)}
                    className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 block">سعر مبيع الزبون (ل.س):</label>
                  <input
                    type="text"
                    required
                    value={pSellPrice}
                    onChange={(e) => setPSellPrice(e.target.value)}
                    className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">حد التنبيه الأدنى للطلب:</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={pMinAlert}
                  onChange={(e) => setPMinAlert(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setIsEditProductOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition cursor-pointer text-center"
              >
                تراجع
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer text-center"
              >
                تحديث وحفظ التعديلات
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PURCHASE / RESTOCK STOCK MODAL */}
      {isRestockOpen && selectedProduct && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fadeIn" id="restock-modal">
          <form onSubmit={handleRestockSubmit} className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-indigo-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-300" />
                <h3 className="font-bold text-sm">توريد مشتريات: {selectedProduct.name}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsRestockOpen(false)}
                className="text-indigo-200 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-indigo-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-right" dir="rtl">
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg text-indigo-900 text-xs leading-relaxed">
                * ملاحظة: سيؤدي توريد كميات إضافية للمستودع إلى زيادة مخزون هذا المنتج، وتسجيل فاتورة مصروف تلقائياً بقيمة إجمالي المشتريات ضمن الوردية.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">الكمية المراد إضافتها (حبة):</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={actionQty}
                  onChange={(e) => setActionQty(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">سعر شراء الحبة الواحد من المورد (ل.س):</label>
                <input
                  type="text"
                  required
                  value={customRestockPrice}
                  onChange={(e) => setCustomRestockPrice(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>

              <div className="bg-gray-100 p-3 rounded-xl border border-gray-200/50 flex justify-between items-center text-xs text-gray-700 font-bold">
                <span>إجمالي كلفة الفاتورة المحتسبة:</span>
                <span className="font-mono text-rose-600 text-sm">
                  {formatCurrency((parseInt(actionQty.toString()) || 0) * (parseFloat(customRestockPrice) || 0))}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setIsRestockOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition cursor-pointer text-center"
              >
                تراجع
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition cursor-pointer text-center"
              >
                تأكيد توريد المشتريات
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DIRECT CASH SALE MODAL */}
      {isDirectSaleOpen && selectedProduct && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fadeIn" id="direct-sale-modal">
          <form onSubmit={handleDirectSaleSubmit} className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-gray-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-sm">بيع كاش مباشر: {selectedProduct.name}</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsDirectSaleOpen(false)}
                className="text-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-right" dir="rtl">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">الكمية المباعة (حبة):</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedProduct.currentStock}
                  value={actionQty}
                  onChange={(e) => setActionQty(e.target.value)}
                  className="w-full border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-sm text-gray-800 outline-hidden font-mono text-center"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">* المتبقي المتوفر بالمستودع: {selectedProduct.currentStock} حبة</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-semibold py-1">
                <div className="p-2 bg-gray-50 border rounded-lg text-center">
                  <span className="text-gray-400 text-[10px] block">سعر الحبة للزبون</span>
                  <span className="text-gray-700 font-mono block font-bold">{formatCurrency(selectedProduct.sellPrice)}</span>
                </div>
                <div className="p-2 bg-indigo-50/50 border border-indigo-100 rounded-lg text-center text-indigo-900">
                  <span className="text-indigo-400 text-[10px] block font-bold">المجموع الكلي المطلوب</span>
                  <span className="text-indigo-700 font-mono block font-bold text-sm">
                    {formatCurrency((parseInt(actionQty.toString()) || 0) * selectedProduct.sellPrice)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setIsDirectSaleOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition cursor-pointer text-center"
              >
                تراجع
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer text-center"
              >
                تسجيل البيع وقبض الكاش
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD EXPENSE MODAL */}
      {isAddExpenseOpen && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all duration-300 animate-fadeIn" id="add-expense-modal">
          <form onSubmit={handleAddExpenseSubmit} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-rose-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">تسجيل فاتورة مصروف جديدة</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="text-rose-200 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-rose-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-right" dir="rtl">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">فئة المصروف:</label>
                <select
                  value={expCat}
                  onChange={(e) => setExpCat(e.target.value as Expense["category"])}
                  className="w-full border border-gray-200 focus:border-rose-500 rounded-xl px-3 py-2.5 text-xs bg-white cursor-pointer font-sans"
                >
                  <option value="fawateer">سداد فواتير (كهرباء، إنترنت، مياه ...)</option>
                  <option value="purchases">مشتريات للمحل ومعدات</option>
                  <option value="maintenance">صيانة أجهزة ومبنى</option>
                  <option value="other">مصاريف عامة أخرى</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">بيان / وصف المصروف:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فاتورة كهرباء شهر 7، شراء يدة بلايستيشن جديدة ..."
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="w-full border border-gray-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">المبلغ المدفوع (ل.س):</label>
                <input
                  type="text"
                  required
                  placeholder="0.00"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full border border-gray-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-3 py-2.5 text-sm text-gray-800 outline-hidden font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setIsAddExpenseOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition cursor-pointer text-center"
              >
                تراجع
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer text-center"
              >
                تسجيل وحسم المصروف
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
