import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';
import { inspectorService, type InspectionStaffDto } from '../../../services';

interface Options {
  centerId?: string;
  showNotice: (msg: string) => void;
}

export function useCenterStaff({ centerId, showNotice }: Options) {
  // --- Staff State ---
  const [staffList, setStaffList] = useState<InspectionStaffDto[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffLoadError, setStaffLoadError] = useState<string | null>(null);
  const latestStaffRequest = useRef(0);
  const [staffSearchTerm, setStaffSearchTerm] = useState('');

  // --- Create Staff Modal State ---
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [createStaffError, setCreateStaffError] = useState<string | null>(null);
  const [createdStaffSuccessData, setCreatedStaffSuccessData] = useState<{
    fullName: string;
    email: string;
    password: string;
  } | null>(null);
  const [hasCopiedCredentials, setHasCopiedCredentials] = useState(false);

  const loadStaff = useCallback(async () => {
    if (!centerId) return;

    const requestId = ++latestStaffRequest.current;
    setIsLoadingStaff(true);
    setStaffLoadError(null);
    try {
      const staff = await inspectorService.getStaff();
      if (requestId === latestStaffRequest.current) setStaffList(staff);
    } catch (error) {
      if (requestId !== latestStaffRequest.current) return;
      setStaffList([]);
      setStaffLoadError(error instanceof Error && error.message
        ? error.message : 'Không thể tải danh sách kỹ thuật viên.');
    } finally {
      if (requestId === latestStaffRequest.current) setIsLoadingStaff(false);
    }
  }, [centerId]);

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    if (!staffSearchTerm.trim()) return staffList;
    const q = staffSearchTerm.toLowerCase().trim();
    return staffList.filter(
      (s) =>
        s.fullName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q)
    );
  }, [staffList, staffSearchTerm]);

  // Action: Submit Create Inspector Staff
  const handleCreateStaffSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateStaffError(null);

    if (!newStaffName.trim() || !newStaffEmail.trim() || !newStaffPassword) {
      setCreateStaffError('Vui lòng điền đầy đủ các trường bắt buộc');
      return;
    }

    if (newStaffPassword.length < 6) {
      setCreateStaffError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setIsCreatingStaff(true);
    try {
      await inspectorService.createStaff({
        email: newStaffEmail.trim(),
        password: newStaffPassword,
        fullName: newStaffName.trim(),
      });

      setCreatedStaffSuccessData({
        fullName: newStaffName.trim(),
        email: newStaffEmail.trim(),
        password: newStaffPassword,
      });

      showNotice(`Đã cấp tài khoản kỹ thuật viên cho ${newStaffName.trim()} thành công!`);

      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
      setShowStaffPassword(false);
      setHasCopiedCredentials(false);

      await loadStaff();
    } catch (err: any) {
      setCreateStaffError(err?.message || 'Không thể tạo tài khoản nhân viên. Vui lòng kiểm tra lại email.');
    } finally {
      setIsCreatingStaff(false);
    }
  };

  // Helper: Copy credentials to clipboard
  const handleCopyCredentials = () => {
    if (!createdStaffSuccessData) return;
    const text = `Tài khoản KTV SecondLife Hub:\n- Họ tên: ${createdStaffSuccessData.fullName}\n- Email: ${createdStaffSuccessData.email}\n- Mật khẩu: ${createdStaffSuccessData.password}\n- Link đăng nhập: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    setHasCopiedCredentials(true);
    setTimeout(() => setHasCopiedCredentials(false), 3000);
  };

  // Generate random password helper
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#%';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewStaffPassword(pwd);
    setShowStaffPassword(true);
  };

  return {
    createdStaffSuccessData,
    createStaffError,
    filteredStaff,
    handleCopyCredentials,
    handleCreateStaffSubmit,
    handleGeneratePassword,
    hasCopiedCredentials,
    isCreateStaffModalOpen,
    isCreatingStaff,
    isLoadingStaff,
    loadStaff,
    newStaffEmail,
    newStaffName,
    newStaffPassword,
    setCreatedStaffSuccessData,
    setCreateStaffError,
    setIsCreateStaffModalOpen,
    setNewStaffEmail,
    setNewStaffName,
    setNewStaffPassword,
    setShowStaffPassword,
    setStaffSearchTerm,
    showStaffPassword,
    staffList,
    staffLoadError,
    staffSearchTerm,
  };
}
