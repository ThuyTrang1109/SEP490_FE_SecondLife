export const formatLalamoveVehicle = (serviceType?: string): { name: string; icon: string; desc: string; standard?: string } => {
  if (!serviceType) {
    return {
      name: 'Chưa có thông tin phương tiện',
      icon: '🚚',
      desc: 'Vui lòng kiểm tra phương tiện trong báo giá vận chuyển',
      standard: 'Phương tiện do Lalamove chỉ định',
    };
  }
  const rawCode = serviceType.trim().toUpperCase();
  const code = rawCode.replace(/^LD_/, '');

  if (code === 'MOTORCYCLE' || code === 'BIKE') {
    return {
      name: 'Xe máy',
      icon: '🏍️',
      desc: 'Giao nhanh hàng nhỏ gọn nội thành',
      standard: 'Cân nặng ≤ 30kg • Kích thước ≤ 50x40x50cm',
    };
  }
  if (code === 'VAN_1000' || code === 'VAN1000') {
    return {
      name: 'Xe Van 1 tấn',
      icon: '🚐',
      desc: 'Chở hàng cồng kềnh, tải trọng lớn che chắn mưa nắng',
      standard: 'Cân nặng ≤ 1.000kg • Thùng xe Van 1 tấn',
    };
  }
  if (code === 'VAN' || code === 'VAN500' || code === 'VAN_500') {
    return {
      name: code === 'VAN' ? 'Xe van' : 'Xe van 500kg',
      icon: '🚐',
      desc: 'Chở hàng cồng kềnh, tải trọng lớn che chắn mưa nắng',
      standard: 'Cân nặng ≤ 500kg • Kích thước ≤ 170x120x120cm',
    };
  }
  if (code === 'PICK_UP_TRUCK' || code === 'PICKUP_TRUCK' || code.includes('PICK_UP') || code.includes('PICKUP')) {
    return {
      name: 'Xe bán tải (Pick-up)',
      icon: '🛻',
      desc: 'Chở hàng cồng kềnh, kiện hàng lớn hoặc vận chuyển đường dài',
      standard: 'Cân nặng ≤ 500kg • Thùng 140x150x50cm',
    };
  }
  if (code === 'TRUCK500' || code === 'TRUCK_500' || code === 'TRUCK_500KG') {
    return {
      name: 'Xe tải 500kg',
      icon: '🚚',
      desc: 'Chở hàng nặng, kích thước lớn an toàn',
      standard: 'Cân nặng ≤ 500kg • Thùng 190x140x140cm',
    };
  }
  if (code === 'TRUCK1000' || code === 'TRUCK_1000' || code === 'TRUCK_1000KG' || code === 'TRUCK_1T') {
    return {
      name: 'Xe tải 1 tấn',
      icon: '🚛',
      desc: 'Xe tải trọng tải lớn',
      standard: 'Cân nặng ≤ 1.000kg • Thùng 300x160x160cm',
    };
  }
  if (code === 'TRUCK1500' || code === 'TRUCK_1500' || code === 'TRUCK_1500KG') {
    return {
      name: 'Xe tải 1.5 tấn',
      icon: '🚛',
      desc: 'Xe tải trọng tải lớn',
      standard: 'Cân nặng ≤ 1.500kg • Thùng 320x160x170cm',
    };
  }
  if (code === 'TRUCK175' || code === 'TRUCK_175') {
    return {
      name: 'Xe tải 1.75 tấn',
      icon: '🚛',
      desc: 'Xe tải thùng rộng đường dài',
      standard: 'Cân nặng ≤ 1.750kg • Thùng 190x140x140cm',
    };
  }
  if (code === 'TRUCK2000' || code === 'TRUCK_2000' || code === 'TRUCK_2000KG' || code === 'TRUCK_2T') {
    return {
      name: 'Xe tải 2 tấn',
      icon: '🚛',
      desc: 'Xe tải hạng nặng',
      standard: 'Cân nặng ≤ 2.000kg • Thùng 400x170x170cm',
    };
  }
  if (code === 'TRUCK2500' || code === 'TRUCK_2500' || code === 'TRUCK_2500KG') {
    return {
      name: 'Xe tải 2.5 tấn',
      icon: '🚛',
      desc: 'Xe tải hạng nặng',
      standard: 'Cân nặng ≤ 2.500kg • Thùng 420x170x180cm',
    };
  }
  if (code === 'TRUCK330' || code === 'TRUCK_330') {
    return {
      name: 'Xe tải 3.3 tấn',
      icon: '🚛',
      desc: 'Xe tải siêu trường siêu trọng',
      standard: 'Cân nặng ≤ 3.300kg • Thùng 300x160x160cm',
    };
  }
  if (code === 'TRUCK550' || code === 'TRUCK_550') {
    return {
      name: 'Xe tải 5.5 tấn',
      icon: '🚛',
      desc: 'Xe tải siêu trường siêu trọng',
      standard: 'Cân nặng ≤ 5.500kg • Thùng 400x170x170cm',
    };
  }
  return {
    name: serviceType,
    icon: '🚚',
    desc: 'Phương tiện Lalamove do hệ thống tự động báo giá',
    standard: 'Tiêu chuẩn phương tiện Lalamove',
  };
};
