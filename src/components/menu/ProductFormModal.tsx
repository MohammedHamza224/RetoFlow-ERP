import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Upload, X } from 'lucide-react';
import { Product, Category } from '@/types/database.types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: any, imageFile: File | null) => Promise<void>;
  categories: Category[];
  editingProduct?: Product | null;
}

export function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  categories,
  editingProduct,
}: ProductFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    category_id: '',
    price: 0,
    cost: 0,
    stock_quantity: 0,
    minimum_stock: 5,
    image_url: '',
    is_active: true,
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingProduct) {
      setFormData({
        name: editingProduct.name,
        sku: editingProduct.sku,
        description: editingProduct.description || '',
        category_id: editingProduct.category_id,
        price: editingProduct.price,
        cost: editingProduct.cost,
        stock_quantity: editingProduct.stock_quantity,
        minimum_stock: editingProduct.minimum_stock,
        image_url: editingProduct.image_url || '',
        is_active: editingProduct.is_active,
      });
      setImagePreview(editingProduct.image_url || null);
    } else {
      setFormData({
        name: '',
        sku: `SKU-${Math.floor(100 + Math.random() * 900)}`,
        description: '',
        category_id: categories.find(c => c.is_active)?.id || categories[0]?.id || '',
        price: 35.00,
        cost: 12.00,
        stock_quantity: 20,
        minimum_stock: 5,
        image_url: '',
        is_active: true,
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setFormError('');
  }, [editingProduct, isOpen, categories]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Image size must be less than 5MB.');
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setFormError('Only JPG, PNG, and WEBP images are allowed.');
      return;
    }

    setFormError('');
    setImageFile(file);

    // Create local preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData(prev => ({ ...prev, image_url: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Product name is required.');
      return;
    }
    if (!formData.sku.trim()) {
      setFormError('Product SKU is required.');
      return;
    }
    if (!formData.category_id) {
      setFormError('Please select a product category.');
      return;
    }
    if (Number(formData.price) < 0) {
      setFormError('Selling price must be greater than or equal to 0.');
      return;
    }
    if (Number(formData.cost) < 0) {
      setFormError('Cost reference must be greater than or equal to 0.');
      return;
    }
    if (Number(formData.stock_quantity) < 0) {
      setFormError('Stock quantity cannot be negative.');
      return;
    }
    if (Number(formData.minimum_stock) < 0) {
      setFormError('Minimum stock threshold cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData, imageFile);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProduct ? 'Edit Restaurant Product' : 'Create New Product'}
      description="Manage product parameters, pricing, cost references, and stock thresholds."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Section 1: Basic Information */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-resto-terracotta-600 border-b border-slate-100 dark:border-slate-800 pb-1">
            1. Basic Information
          </h4>

          {/* Image Upload Section */}
          <div className="space-y-1 mb-4">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Product Image (Optional)</label>
            <div className="flex items-start gap-4 mt-2">
              <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50 overflow-hidden shrink-0">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-1 right-1 bg-black/60 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                      title="Remove Image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Upload className="w-6 h-6 mb-1" />
                    <span className="text-[10px]">No Image</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/jpeg, image/png, image/webp"
                  onChange={handleImageChange}
                  ref={fileInputRef}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-resto-terracotta-50 file:text-resto-terracotta-700 hover:file:bg-resto-terracotta-100 dark:file:bg-resto-terracotta-900/30 dark:file:text-resto-terracotta-300 cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">
                  Supported formats: JPG, PNG, WEBP. Max size: 5MB.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Product Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Truffle Smash Burger"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">SKU Code *</label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="e.g. BRG-001"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Category *</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
              required
            >
              <option value="" disabled>Select Category</option>
              {categories.map(c => (
                <option key={c.id} value={c.id} disabled={!c.is_active}>
                  {c.name} {!c.is_active ? '(Inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Product ingredients, description, or notes..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resto-terracotta-500"
              rows={2}
            />
          </div>
        </div>

        {/* Section 2: Pricing & Cost Snapshot */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-resto-terracotta-600 border-b border-slate-100 dark:border-slate-800 pb-1">
            2. Pricing & Financial Reference
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Selling Price (SAR) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Unit Cost (SAR) *</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                required
              />
              <span className="text-[10px] text-muted-foreground block">
                Used as product cost reference. Historical sales profit uses order_items.unit_cost snapshot.
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Stock Control */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-resto-terracotta-600 border-b border-slate-100 dark:border-slate-800 pb-1">
            3. Stock & Inventory Control
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Current Stock Quantity *</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formData.stock_quantity}
                onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value, 10) || 0 })}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Minimum Stock Alert Threshold *</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={formData.minimum_stock}
                onChange={(e) => setFormData({ ...formData, minimum_stock: parseInt(e.target.value, 10) || 0 })}
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-slate-300 text-resto-terracotta-600 focus:ring-resto-terracotta-500"
              />
              <span>Active Product (Available in POS menu search)</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" size="md" type="button" onClick={onClose}>
            Cancel
          </Button>

          <Button variant="primary" size="md" type="submit" isLoading={isSubmitting}>
            {editingProduct ? 'Save Product Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
