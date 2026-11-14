import { useState } from 'react';
import { categoryService } from '../../../services';
import { CategoryBackend, ItemBackend } from '../../../types';

export function useCenterCatalog() {
  const [categories, setCategories] = useState<CategoryBackend[]>([]);
  const [catalogItems, setCatalogItems] = useState<ItemBackend[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const loadCategoriesAndItems = async () => {
    setIsLoadingCategories(true);
    try {
      const [cats, itms] = await Promise.allSettled([
        categoryService.getCategories(),
        categoryService.getItems(),
      ]);
      if (cats.status === 'fulfilled' && Array.isArray(cats.value)) {
        setCategories(cats.value);
      }
      if (itms.status === 'fulfilled' && Array.isArray(itms.value)) {
        setCatalogItems(itms.value);
      }
    } catch (err) {
      console.warn('Lỗi nạp danh mục sản phẩm:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  return {
    catalogItems,
    categories,
    isLoadingCategories,
    loadCategoriesAndItems,
  };
}
