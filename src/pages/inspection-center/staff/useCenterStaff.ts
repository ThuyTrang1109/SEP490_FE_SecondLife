import React, { useState, useMemo } from 'react';
import { inspectorService, InspectionStaffDto } from '../../../services';
import type { useCenterOrders } from '../orders/useCenterOrders';

interface Options {
  orders: ReturnType<typeof useCenterOrders>['orders'];
  showNotice: (msg: string) => void;
}

export function useCenterStaff({ orders, showNotice }: Options) {
  // --- Staff State ---
  const [staffList, setStaffList] = useState<InspectionStaffDto[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
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

  // --- API Fetch: Staff ---
  const loadStaff = async () => {
    setIsLoadingStaff(true);
    try {
      const data = await inspectorService.getStaff();
      let list = Array.isArray(data) ? [...data] : [];

      // Merge locally registered staff (nếu có đăng ký mới)
      try {
        const raw = localStorage.getItem('center_registered_staff');
        if (raw) {
          const localStaff = JSON.parse(raw);
          if (Array.isArray(localStaff)) {
            localStaff.forEach((s: any) => {
              if (!list.some((existing) => existing.id === s.id || existing.email === s.email)) {
                list.push({
                  id: s.id,
                  email: s.email || 'ktv@secondlife.vn',
                  fullName: s.fullName || s.name || 'Kỹ thuật viên',
                  phone: s.phone || '0901234567',
                  accountStatus: s.accountStatus || 'ACTIVE',
                  assignedOrdersCount: s.assignedOrdersCount || 0,
                  role: 'INSPECTOR',
                });
              }
            });
          }
        }
      } catch { }

      // Nếu Backend chưa có nhân sự nào (hệ thống mới / môi trường demo), dự phòng KTV mặc định
      if (list.length === 0) {
        const seededKtv1: InspectionStaffDto = {
          id: 'a50d1568-1111-4222-9333-7272a95473db',
          email: 'inspector@secondlife.com',
          fullName: 'Kiểm Định Viên 1 (KTV Trưởng)',
          phone: '0901234567',
          accountStatus: 'ACTIVE',
          assignedOrdersCount: 0,
          role: 'INSPECTOR',
        };
        list.push(seededKtv1);
      }

      // 3. Tính số task thực tế cho từng KTV
      list = list.map((st) => {
        let taskCount = 0;
        try {
          // Đếm trực tiếp từ danh sách đơn hiện có
          orders.forEach((o) => {
            if (o.inspectorId === st.id || (st.email && o.inspectorId === st.email)) {
              taskCount++;
            }
          });

          const raw = localStorage.getItem('recent_placed_orders');
          if (raw) {
            const allOrders = JSON.parse(raw);
            if (Array.isArray(allOrders)) {
              allOrders.forEach((o: any) => {
                let assignedId = o.inspectorId;
                try {
                  const rawAssign = localStorage.getItem(`order_assigned_inspector_${o.id}`);
                  if (rawAssign) {
                    const assignData = JSON.parse(rawAssign);
                    assignedId = assignData.inspectorId || assignedId;
                  }
                } catch { }
                if (assignedId === st.id || (st.email && assignedId === st.email)) {
                  taskCount++;
                }
              });
            }
          }
        } catch { }
        return {
          ...st,
          assignedOrdersCount: Math.max(st.assignedOrdersCount || 0, taskCount),
        };
      });

      setStaffList(list);
    } catch (err: any) {
      console.warn('Lỗi tải danh sách nhân viên KTV:', err);
      const seededKtv1: InspectionStaffDto = {
        id: 'a50d1568-1111-4222-9333-7272a95473db',
        email: 'inspector@secondlife.com',
        fullName: 'Kiểm Định Viên 1 (KTV Trưởng)',
        phone: '0901234567',
        accountStatus: 'ACTIVE',
        assignedOrdersCount: 0,
        role: 'INSPECTOR',
      };
      const defaultKtv2: InspectionStaffDto = {
        id: 'ins-a50d1568',
        email: 'nguyen.ktv@secondlife.vn',
        fullName: 'Nguyễn Văn Inspector (KTV số 1)',
        phone: '0908889999',
        accountStatus: 'ACTIVE',
        assignedOrdersCount: 0,
        role: 'INSPECTOR',
      };
      setStaffList([seededKtv1, defaultKtv2]);
    } finally {
      setIsLoadingStaff(false);
    }
  };

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
  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
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

      // Persist newly created staff to center_registered_staff
      try {
        const raw = localStorage.getItem('center_registered_staff');
        const list = raw ? JSON.parse(raw) : [];
        list.push({
          id: `ktv_${Date.now()}`,
          fullName: newStaffName.trim(),
          email: newStaffEmail.trim(),
          phone: '0901234567',
          accountStatus: 'ACTIVE',
          assignedOrdersCount: 0,
          role: 'INSPECTOR',
        });
        localStorage.setItem('center_registered_staff', JSON.stringify(list));
      } catch { }

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
    staffSearchTerm,
  };
}
