import { useState } from 'react';
import { inspectorService } from '../../services';
import { InspectionCenterProfile } from '../../types';

interface Options {
  showNotice: (msg: string) => void;
}

export function useCenterProfile({ showNotice }: Options) {
  // --- Center Profile State (GET /api/v1/inspector-center/profile) ---
  const [centerProfile, setCenterProfile] = useState<InspectionCenterProfile | null>(null);
  const [isLoadingCenterProfile, setIsLoadingCenterProfile] = useState(false);
  const [centerProfileError, setCenterProfileError] = useState<string | null>(null);

  const loadCenterProfile = async () => {
    setIsLoadingCenterProfile(true);
    setCenterProfileError(null);
    try {
      const res = await inspectorService.getCenterProfile();
      setCenterProfile(res);
      return res;
    } catch (err: any) {
      console.warn('Load center profile error:', err);
      setCenterProfileError(err?.message || 'Không thể tải thông tin hồ sơ trung tâm.');
    } finally {
      setIsLoadingCenterProfile(false);
    }
  };

  const handleProfileUpdated = (updated: InspectionCenterProfile) => {
    setCenterProfile(updated);
    showNotice('Đã cập nhật hồ sơ và địa chỉ tiếp nhận của trung tâm thành công!');
  };

  return {
    centerProfile,
    centerProfileError,
    handleProfileUpdated,
    isLoadingCenterProfile,
    loadCenterProfile,
  };
}
