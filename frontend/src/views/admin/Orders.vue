<template>
  <div class="admin-page">
    <AdminSidebar />
    
    <div class="admin-content">
      <h1>订单管理</h1>
      
      <div class="action-bar">
      </div>
      
      <div class="orders-table">
        <table>
          <thead>
            <tr>
              <th>订单ID</th>
              <th>用户</th>
              <th>商品</th>
              <th>金额</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orders" :key="order.id">
              <td>{{ order.id }}</td>
              <td>{{ order.user }}</td>
              <td>{{ order.product }}</td>
              <td>¥{{ order.amount }}</td>
              <td :class="`status-${order.status}`">{{ order.status }}</td>
              <td>{{ order.created_at }}</td>
              <td>
                <button class="edit-btn">编辑</button>
                <button class="delete-btn">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AdminSidebar from '@/components/AdminSidebar.vue'

const router = useRouter()
const orders = ref([
  { id: 1, user: '张三', product: '普通种子 x 5', amount: 50, status: '已完成', created_at: '2026-04-01 10:00' },
  { id: 2, user: '李四', product: '稀有种子 x 2', amount: 100, status: '已完成', created_at: '2026-04-02 11:00' },
  { id: 3, user: '王五', product: '史诗种子 x 1', amount: 100, status: '待支付', created_at: '2026-04-03 12:00' },
])

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  router.push('/login')
}
</script>

<style scoped>
.admin-page {
  display: flex;
  min-height: 100vh;
  background: #f5f5f5;
}

.admin-sidebar {
  width: 200px;
  background: #2c5a2a;
  color: white;
  padding: 20px;
}

.admin-sidebar h2 {
  margin: 0 0 32px 0;
  font-size: 1.5rem;
}

.admin-sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.admin-sidebar ul li {
  margin-bottom: 12px;
  padding: 12px 16px 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
}

.admin-sidebar ul li::before {
  content: '•';
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.2rem;
}

.admin-sidebar ul li:hover {
  background: rgba(255, 255, 255, 0.1);
}

.admin-sidebar ul li a {
  color: white;
  text-decoration: none;
  display: block;
}

/* 二级菜单样式 */
.menu-item {
  position: relative;
}

.menu-title {
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 12px 24px;
  border-radius: 8px;
  transition: background-color 0.2s ease;
  position: relative;
}

.menu-title::before {
  content: '•';
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.2rem;
}

.menu-title:hover {
  background: rgba(255, 255, 255, 0.1);
}

.menu-arrow {
  transition: transform 0.2s ease;
  font-size: 0.8rem;
}

.menu-arrow.open {
  transform: rotate(90deg);
}

.sub-menu {
  margin: 8px 0 0 24px;
  padding: 0;
  list-style: none;
  position: relative;
}

.sub-menu::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.2);
}

.sub-menu li {
  margin-bottom: 4px;
  padding: 8px 12px 8px 24px;
  border-radius: 6px;
  font-size: 0.9rem;
  position: relative;
}

.sub-menu li::before {
  content: '•';
  position: absolute;
  left: 12px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.2rem;
}

.sub-menu li:hover {
  background: rgba(255, 255, 255, 0.1);
}

.sub-menu li a {
  display: block;
  color: rgba(255, 255, 255, 0.9);
}

.admin-content {
  flex: 1;
  padding: 32px;
  overflow-y: auto;
}

.admin-content h1 {
  margin: 0 0 32px 0;
  color: #2c5a2a;
}

.action-bar {
  display: flex;
  margin-bottom: 24px;
  justify-content: flex-end;
}


.orders-table {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.orders-table table {
  width: 100%;
  border-collapse: collapse;
}

.orders-table th,
.orders-table td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
}

.orders-table th {
  background: #f5f5f5;
  font-weight: bold;
  color: #333;
}

.orders-table tr:hover {
  background: #f9f9f9;
}

.status-已完成 {
  color: #4caf50;
  font-weight: bold;
}

.status-待支付 {
  color: #ff9800;
  font-weight: bold;
}

.status-已取消 {
  color: #f44336;
  font-weight: bold;
}

.edit-btn,
.delete-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-right: 8px;
}

.edit-btn {
  background: #2196f3;
  color: white;
}

.edit-btn:hover {
  background: #1976d2;
}

.delete-btn {
  background: #f44336;
  color: white;
}

.delete-btn:hover {
  background: #d32f2f;
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .admin-page {
    background: #1a1a1a;
  }
  
  .admin-sidebar {
    background: #1a3a1a;
  }
  
  .admin-content h1 {
    color: #8bc34a;
  }
  
  .search-bar input {
    background: #2a2a2a;
    border-color: #444;
    color: #e0e0e0;
  }
  
  .orders-table {
    background: #2a2a2a;
  }
  
  .orders-table th {
    background: #3a3a3a;
    color: #e0e0e0;
  }
  
  .orders-table td {
    border-bottom: 1px solid #3a3a3a;
    color: #e0e0e0;
  }
  
  .orders-table tr:hover {
    background: #333;
  }
  
  .status-已完成 {
    color: #8bc34a;
  }
  
  .status-待支付 {
    color: #ffb74d;
  }
  
  .status-已取消 {
    color: #ef5350;
  }
}
</style>