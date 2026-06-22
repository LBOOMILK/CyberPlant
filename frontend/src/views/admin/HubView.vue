<template>
  <div class="hub-container" ref="hubRef">
    <!-- SVG 动态连线 -->
    <svg v-if="centerExpanded" class="hub-lines">
      <line v-for="(line, i) in dynamicLines" :key="'line-'+i"
        :x1="line.x1" :y1="line.y1"
        :x2="line.x2" :y2="line.y2"
        stroke="rgba(0,255,136,0.2)" stroke-width="2"
        :style="{ animationDelay: i * 0.05 + 's' }"
        class="hub-line" />
    </svg>

    <!-- 顶部标题栏 -->
    <div class="hub-top">
      <span class="hub-title">🌿 CyberPlant 管理后台</span>
      <button class="theme-switch-btn" @click="switchToClassic">📋 经典面板</button>
    </div>

    <!-- 中心枢纽 -->
    <div class="hub-center" :class="{ expanded: centerExpanded }" @click="toggleCenter">
      <!-- 脉冲引导特效 -->
      <div v-if="!centerExpanded" class="pulse-ring"></div>
      <div v-if="!centerExpanded" class="pulse-ring delay"></div>
      <span class="hub-icon" :class="{ rotated: centerExpanded }">⚡</span>
    </div>

    <!-- 8 个模块按钮（中心展开，均匀分布） -->
    <div
      v-for="(mod, i) in allModules"
      :key="'mod-'+i"
      :ref="el => { if (el) moduleRefs[i] = el }"
      class="hub-module"
      :class="{ active: activeModule === mod.id, visible: centerExpanded }"
      :style="{ '--ox': mod.ox, '--oy': mod.oy }"
      @click="mod.action ? mod.action() : openModule(mod.id)"
    >
      <span class="mod-icon">{{ mod.icon }}</span>
      <span class="mod-label">{{ mod.label }}</span>
    </div>

    <!-- 退出登录确认 -->
    <div v-if="showLogoutConfirm" class="modal-overlay" @mousedown.self="showLogoutConfirm = false">
      <div class="modal-card" style="max-width:360px;text-align:center;">
        <h3>退出登录</h3>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 20px 0;font-size:13px;">确定要退出登录吗？</p>
        <div class="modal-actions" style="justify-content:center;">
          <button @click="showLogoutConfirm = false">取消</button>
          <button class="primary" style="background:rgba(220,38,38,0.15);border-color:#dc2626;color:#f87171;" @click="handleLogout">确定退出</button>
        </div>
      </div>
    </div>

    <!-- 重置确认 -->
    <div v-if="showResetConfirm" class="modal-overlay" @mousedown.self="showResetConfirm = false">
      <div class="modal-card" style="max-width:420px;">
        <h3>⚠️ 确认重置</h3>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 8px 0;font-size:13px;">此操作将清空所有数据并重建，包括：</p>
        <ul style="color:#f87171;font-size:12px;margin:0 0 16px 20px;line-height:1.8;">
          <li>所有用户账号和数据</li>
          <li>所有物品、宠物、装饰数据</li>
          <li>所有订单和好友关系</li>
        </ul>
        <p style="color:var(--text-secondary,#8b949e);margin:0 0 16px 0;font-size:13px;">重建后自动插入默认数据，并创建两个演示账号。</p>
        <div class="modal-actions" style="justify-content:center;">
          <button @click="showResetConfirm = false">取消</button>
          <button class="primary" style="background:rgba(220,38,38,0.15);border-color:#dc2626;color:#f87171;" @click="doReset">确认重置</button>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div v-if="activeModule" class="detail-overlay" @mousedown.self="closeModule">
      <div class="detail-card">
        <button class="detail-close" @click="closeModule">✕</button>
        <h2>{{ currentModuleTitle }}</h2>
        <div class="detail-body">
          <!-- 物品 / 宠物 / 饰品 管理（Tab切换） -->
          <div v-if="activeModule === 'items'">
            <!-- 顶部 Tab 切换 -->
            <div class="hub-tabs">
              <button :class="['hub-tab', { active: hubItemTab === 'items' }]" @click="switchHubItemTab('items')">📦 物品</button>
              <button :class="['hub-tab', { active: hubItemTab === 'pets' }]" @click="switchHubItemTab('pets')">🐾 宠物</button>
              <button :class="['hub-tab', { active: hubItemTab === 'decorations' }]" @click="switchHubItemTab('decorations')">🎀 饰品</button>
            </div>

            <!-- ============ 物品 Tab ============ -->
            <div v-if="hubItemTab === 'items'">
              <div class="detail-toolbar">
                <select v-model="itemFilter" class="detail-select">
                  <option value="all">全部类型</option>
                  <option value="seed">🌱 种子</option>
                  <option value="crop">🌾 作物</option>
                  <option value="fertilizer">🧪 肥料</option>
                  <option value="pet_food">🍖 宠物粮</option>
                </select>
                <button class="add-btn" @click="showAddItem = true">+ 添加物品</button>
              </div>
              <table class="detail-table">
                <thead>
                  <tr><th>ID</th><th>图标</th><th>名称</th><th>类型</th><th>稀有度</th><th>买价</th><th>卖价</th><th>可购买</th><th>操作</th></tr>
                </thead>
                <tbody>
                  <tr v-for="item in filteredItems" :key="item.id">
                    <td>{{ item.id }}</td>
                    <td>{{ item.icon }}</td>
                    <td>{{ item.name }}</td>
                    <td>{{ itemTypeName(item.item_type) }}</td>
                    <td><span :class="['rarity-tag', item.rarity]">{{ item.rarity }}</span></td>
                    <td>{{ item.buy_price }}</td>
                    <td>{{ item.sell_price }}</td>
                    <td>{{ item.purchasable !== false ? '✅' : '❌' }}</td>
                    <td>
                      <button class="action-btn-sm" @click="editItem(item)">编辑</button>
                      <button class="action-btn-sm danger" @click="deleteItem(item.id)">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="loadingItems" style="text-align:center;padding:20px;color:var(--text-muted,#8b949e)">加载中...</div>
              <div v-else-if="filteredItems.length === 0 && !loadingItems" style="text-align:center;padding:30px;color:var(--text-muted,#8b949e)">暂无物品</div>
            </div>

            <!-- ============ 宠物 Tab ============ -->
            <div v-if="hubItemTab === 'pets'">
              <div class="detail-toolbar">
              <span></span>
              <button class="add-btn" @click="showAddPet = true">+ 添加宠物</button>
            </div>
            <table class="detail-table">
              <thead>
                <tr><th>ID</th><th>图标</th><th>名称</th><th>稀有度</th><th>基础加成</th><th>价格</th><th>货币</th><th>可售</th><th>测试</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="pet in hubPets" :key="pet.id">
                  <td>{{ pet.id }}</td>
                  <td>{{ pet.icon }}</td>
                  <td>{{ pet.name }}</td>
                  <td><span :class="['rarity-tag', pet.rarity]">{{ pet.rarity }}</span></td>
                  <td>{{ pet.base_bonus }}</td>
                  <td>{{ pet.price_amount }}</td>
                  <td>{{ currencyName(pet.price_type) }}</td>
                  <td>{{ pet.is_shop !== false ? '✅' : '❌' }}</td>
                  <td>{{ pet.is_test ? '✅' : '❌' }}</td>
                  <td>
                    <button class="action-btn-sm" @click="editPet(pet)">编辑</button>
                    <button class="action-btn-sm danger" @click="deletePet(pet.id)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="loadingPets" style="text-align:center;padding:20px;color:var(--text-muted,#8b949e)">加载中...</div>
            <div v-else-if="hubPets.length === 0 && !loadingPets" style="text-align:center;padding:30px;color:var(--text-muted,#8b949e)">暂无宠物</div>
            </div>

            <!-- ============ 饰品 Tab ============ -->
            <div v-if="hubItemTab === 'decorations'">
              <div class="detail-toolbar">
              <span></span>
              <button class="add-btn" @click="showAddDec = true">+ 添加饰品</button>
              </div>
              <table class="detail-table">
                <thead>
                  <tr><th>ID</th><th>图标</th><th>名称</th><th>槽位</th><th>品质</th><th>加成</th><th>专属宠物</th><th>操作</th></tr>
                </thead>
                <tbody>
                  <tr v-for="dec in hubDecorations" :key="dec.id">
                    <td>{{ dec.id }}</td>
                    <td>{{ dec.icon }}</td>
                    <td>{{ dec.name }}</td>
                    <td>{{ dec.slot_type }}</td>
                    <td><span :class="['rarity-tag', dec.quality]">{{ dec.quality }}</span></td>
                    <td>+{{ dec.bonus }}</td>
                    <td>{{ dec.pet_name || '-' }}</td>
                    <td>
                      <button class="action-btn-sm" @click="editDecoration(dec)">编辑</button>
                      <button class="action-btn-sm danger" @click="deleteDecoration(dec.id)">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div v-if="loadingDecs" style="text-align:center;padding:20px;color:var(--text-muted,#8b949e)">加载中...</div>
              <div v-else-if="hubDecorations.length === 0 && !loadingDecs" style="text-align:center;padding:30px;color:var(--text-muted,#8b949e)">暂无饰品</div>
            </div>

            <!-- ============ 编辑物品弹窗 ============ -->
            <div v-if="showEditItem" class="modal-overlay" @mousedown.self="showEditItem = false">
              <div class="modal-card">
                <h3>编辑物品</h3>
                <div class="form-grid">
                  <label>名称 <input v-model="editItemForm.name" /></label>
                  <label>图标 <input v-model="editItemForm.icon" /></label>
                  <label v-if="editItemForm.item_type === 'seed'">买价 <span class="number-input-group"><button class="num-btn" @click="editItemForm.buy_price = Math.max(0, editItemForm.buy_price - 100)" type="button">−</button><input v-model.number="editItemForm.buy_price" type="number" min="0" /><button class="num-btn" @click="editItemForm.buy_price += 100" type="button">+</button></span></label>
                  <label>卖价 <span class="number-input-group"><button class="num-btn" @click="editItemForm.sell_price = Math.max(0, editItemForm.sell_price - 100)" type="button">−</button><input v-model.number="editItemForm.sell_price" type="number" min="0" /><button class="num-btn" @click="editItemForm.sell_price += 100" type="button">+</button></span></label>
                  <label v-if="editItemForm.item_type === 'seed'">基础产出 <span class="number-input-group"><button class="num-btn" @click="editItemForm.base_yield = Math.max(0, (editItemForm.base_yield || 0) - 1)" type="button">−</button><input v-model.number="editItemForm.base_yield" type="number" min="0" /><button class="num-btn" @click="editItemForm.base_yield = (editItemForm.base_yield || 0) + 1" type="button">+</button></span></label>
                  <label>货币
                    <select v-model="editItemForm.currency_type">
                      <option value="silver_coin">银币</option>
                      <option value="gold_coin">金币</option>
                      <option value="diamond">钻石</option>
                    </select>
                  </label>
                  <label v-if="editItemForm.item_type !== 'crop'">商店显示<select v-model="editItemForm.is_shop"><option :value="true">是</option><option :value="false">否</option></select></label><label v-if="editItemForm.item_type === 'seed'">可购买<select v-model="editItemForm.purchasable"><option :value="true">是</option><option :value="false">否（售罄）</option></select></label>
                </div>
                <div class="modal-actions">
                  <button @click="showEditItem = false">取消</button>
                  <button class="primary" @click="saveItem">保存</button>
                </div>
              </div>
            </div>

            <!-- ============ 添加物品弹窗 ============ -->
            <div v-if="showAddItem" class="modal-overlay" @mousedown.self="showAddItem = false">
              <div class="modal-card">
                <h3>添加物品</h3>
                <div class="form-grid">
                  <label>名称 <input v-model="newItemForm.name" /></label>
                  <label>图标 <input v-model="newItemForm.icon" /></label>
                  <label>类型
                    <select v-model="newItemForm.item_type">
                      <option value="seed">种子</option>
                      <option value="crop">作物</option>
                      <option value="fertilizer">肥料</option>
                      <option value="pet_food">宠物粮</option>
                    </select>
                  </label>
                  <label>稀有度
                    <select v-model="newItemForm.rarity">
                      <option value="C">C</option>
                      <option value="B">B</option>
                      <option value="A">A</option>
                      <option value="S">S</option>
                      <option value="SSR">SSR</option><option value="SSS">SSS</option>
                    </select>
                  </label>
                  <label v-if="newItemForm.item_type === 'seed'">买价 <span class="number-input-group"><button class="num-btn" @click="newItemForm.buy_price = Math.max(0, newItemForm.buy_price - 100)" type="button">−</button><input v-model.number="newItemForm.buy_price" type="number" min="0" /><button class="num-btn" @click="newItemForm.buy_price += 100" type="button">+</button></span></label>
                  <label>卖价 <span class="number-input-group"><button class="num-btn" @click="newItemForm.sell_price = Math.max(0, newItemForm.sell_price - 100)" type="button">−</button><input v-model.number="newItemForm.sell_price" type="number" min="0" /><button class="num-btn" @click="newItemForm.sell_price += 100" type="button">+</button></span></label>
                  <label v-if="newItemForm.item_type === 'seed'">基础产出 <span class="number-input-group"><button class="num-btn" @click="newItemForm.base_yield = Math.max(0, newItemForm.base_yield - 1)" type="button">−</button><input v-model.number="newItemForm.base_yield" type="number" min="0" /><button class="num-btn" @click="newItemForm.base_yield++" type="button">+</button></span></label>
                  <label v-if="newItemForm.item_type !== 'crop'">商店显示<select v-model="newItemForm.is_shop"><option :value="true">是</option><option :value="false">否</option></select></label><label v-if="newItemForm.item_type === 'seed'">可购买<select v-model="newItemForm.purchasable"><option :value="true">是</option><option :value="false">否（售罄）</option></select></label>
                </div>
                <div class="modal-actions">
                  <button @click="showAddItem = false">取消</button>
                  <button class="primary" @click="addItem">添加</button>
                </div>
              </div>
            </div>

            <!-- ============ 编辑宠物弹窗 ============ -->
            <div v-if="showEditPet" class="modal-overlay" @mousedown.self="showEditPet = false">
              <div class="modal-card">
                <h3>编辑宠物</h3>
                <div class="form-grid">
                  <label>名称 <input v-model="editPetForm.name" /></label>
                  <label>图标 <input v-model="editPetForm.icon" /></label>
                  <label>稀有度
                    <select v-model="editPetForm.rarity">
                      <option value="C">C</option><option value="B">B</option><option value="A">A</option><option value="S">S</option><option value="SSR">SSR</option><option value="SSS">SSS</option>
                    </select>
                  </label>
                  <label>基础加成
                    <span class="number-input-group"><button class="num-btn" @click="editPetForm.base_bonus = Math.max(0, editPetForm.base_bonus - 1)" type="button">−</button><input v-model.number="editPetForm.base_bonus" type="number" min="0" /><button class="num-btn" @click="editPetForm.base_bonus += 1" type="button">+</button></span>
                  </label>
                  <label>价格 <span class="number-input-group"><button class="num-btn" @click="editPetForm.price_amount = Math.max(0, editPetForm.price_amount - 100)" type="button">−</button><input v-model.number="editPetForm.price_amount" type="number" min="0" /><button class="num-btn" @click="editPetForm.price_amount += 100" type="button">+</button></span></label>
                  <label>货币
                    <select v-model="editPetForm.price_type">
                      <option value="silver_coin">银币</option>
                      <option value="gold_coin">金币</option>
                      <option value="diamond">钻石</option>
                    </select>
                  </label>
                  <label>可购买<select v-model="editPetForm.purchasable"><option :value="true">是</option><option :value="false">否</option></select></label>
                </div>
                <div class="modal-actions">
                  <button @click="showEditPet = false">取消</button>
                  <button class="primary" @click="savePet">保存</button>
                </div>
              </div>
            </div>

            <!-- ============ 添加宠物弹窗 ============ -->
            <div v-if="showAddPet" class="modal-overlay" @mousedown.self="showAddPet = false">
              <div class="modal-card">
                <h3>添加宠物</h3>
                <div class="form-grid">
                  <label>名称 <input v-model="newPetForm.name" /></label>
                  <label>图标 <input v-model="newPetForm.icon" placeholder="🐱" /></label>
                  <label>稀有度
                    <select v-model="newPetForm.rarity">
                      <option value="C">C</option><option value="B">B</option><option value="A">A</option><option value="S">S</option><option value="SSR">SSR</option><option value="SSS">SSS</option>
                    </select>
                  </label>
                  <label>价格 <span class="number-input-group"><button class="num-btn" @click="newPetForm.price_amount = Math.max(0, newPetForm.price_amount - 100)" type="button">−</button><input v-model.number="newPetForm.price_amount" type="number" min="0" /><button class="num-btn" @click="newPetForm.price_amount += 100" type="button">+</button></span></label>
                  <label>基础加成 <span class="number-input-group"><button class="num-btn" @click="newPetForm.base_bonus = Math.max(0, newPetForm.base_bonus - 1)" type="button">−</button><input v-model.number="newPetForm.base_bonus" type="number" min="0" /><button class="num-btn" @click="newPetForm.base_bonus += 1" type="button">+</button></span></label>
                  <label>货币
                    <select v-model="newPetForm.price_type">
                      <option value="silver_coin">银币</option>
                      <option value="gold_coin">金币</option>
                      <option value="diamond">钻石</option>
                    </select>
                  </label>
                  <label>可购买<select v-model="newPetForm.purchasable"><option :value="true">是</option><option :value="false">否</option></select></label>
                </div>
                <div class="modal-actions">
                  <button @click="showAddPet = false">取消</button>
                  <button class="primary" @click="addPet">添加</button>
                </div>
              </div>
            </div>

            <!-- ============ 编辑饰品弹窗 ============ -->
            <div v-if="showEditDec" class="modal-overlay" @mousedown.self="showEditDec = false">
              <div class="modal-card">
                <h3>编辑饰品</h3>
                <div class="form-grid">
                  <label>名称 <input v-model="editDecForm.name" /></label>
                  <label>图标 <input v-model="editDecForm.icon" /></label>
                  <label>槽位类型
                    <select v-model="editDecForm.slot_type">
                      <option value="head">头部</option>
                      <option value="neck">颈部</option>
                      <option value="back">背部</option>
                      <option value="special">特殊</option>
                    </select>
                  </label>
                  <label>品质
                    <select v-model="editDecForm.quality">
                      <option value="C">C</option><option value="B">B</option><option value="A">A</option><option value="S">S</option><option value="SSR">SSR</option><option value="SSS">SSS</option>
                    </select>
                  </label>
                  <label>加成值 <span class="number-input-group"><button class="num-btn" @click="editDecForm.bonus = Math.max(0, editDecForm.bonus - 1)" type="button">−</button><input v-model.number="editDecForm.bonus" type="number" min="0" /><button class="num-btn" @click="editDecForm.bonus += 1" type="button">+</button></span></label>
                  <label>价格
                    <span class="number-input-group"><button class="num-btn" @click="editDecForm.price_amount = Math.max(0, editDecForm.price_amount - 100)" type="button">−</button><input v-model.number="editDecForm.price_amount" type="number" min="0" /><button class="num-btn" @click="editDecForm.price_amount += 100" type="button">+</button></span>
                  </label>
                  <label>货币
                    <select v-model="editDecForm.price_type">
                      <option value="silver_coin">银币</option><option value="gold_coin">金币</option><option value="diamond">钻石</option>
                    </select>
                  </label>
                  <label>专属宠物
                    <select v-model="editDecForm.pet_id">
                      <option :value="null">通用</option>
                      <option v-for="pet in hubPets" :key="pet.id" :value="pet.id">{{ pet.icon }} {{ pet.name }}</option>
                    </select>
                  </label>
                </div>
                <div class="modal-actions">
                  <button @click="showEditDec = false">取消</button>
                  <button class="primary" @click="saveDecoration">保存</button>
                </div>
              </div>
            </div>

            <!-- ============ 添加饰品弹窗 ============ -->
            <div v-if="showAddDec" class="modal-overlay" @mousedown.self="showAddDec = false">
              <div class="modal-card">
                <h3>添加饰品</h3>
                <div class="form-grid">
                  <label>名称 <input v-model="newDecForm.name" /></label>
                  <label>图标 <input v-model="newDecForm.icon" placeholder="🎀" /></label>
                  <label>槽位类型
                    <select v-model="newDecForm.slot_type">
                      <option value="head">头部</option>
                      <option value="neck">颈部</option>
                      <option value="back">背部</option>
                      <option value="special">特殊</option>
                    </select>
                  </label>
                  <label>品质
                    <select v-model="newDecForm.quality">
                      <option value="C">C</option><option value="B">B</option><option value="A">A</option><option value="S">S</option><option value="SSR">SSR</option><option value="SSS">SSS</option>
                    </select>
                  </label>
                  <label>加成值
                    <span class="number-input-group"><button class="num-btn" @click="newDecForm.bonus = Math.max(0, newDecForm.bonus - 1)" type="button">−</button><input v-model.number="newDecForm.bonus" type="number" min="0" /><button class="num-btn" @click="newDecForm.bonus += 1" type="button">+</button></span>
                  </label>
                  <label>价格 <span class="number-input-group"><button class="num-btn" @click="newDecForm.price_amount = Math.max(0, newDecForm.price_amount - 100)" type="button">−</button><input v-model.number="newDecForm.price_amount" type="number" min="0" /><button class="num-btn" @click="newDecForm.price_amount += 100" type="button">+</button></span></label>
                  <label>货币
                    <select v-model="newDecForm.price_type">
                      <option value="silver_coin">银币</option><option value="gold_coin">金币</option><option value="diamond">钻石</option>
                    </select>
                  </label>
                  <label>专属宠物
                    <select v-model="newDecForm.pet_id">
                      <option :value="null">通用</option>
                      <option v-for="pet in hubPets" :key="pet.id" :value="pet.id">{{ pet.icon }} {{ pet.name }}</option>
                    </select>
                  </label>
                </div>
                <div class="modal-actions">
                  <button @click="showAddDec = false">取消</button>
                  <button class="primary" @click="addDecoration">添加</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 用户管理（含管理员 tab） -->
          <div v-if="activeModule === 'users'">
            <div class="user-tabs">
              <button :class="['tab-btn', { active: userTab === 'users' }]" @click="userTab = 'users'">👥 普通用户</button>
              <button :class="['tab-btn', { active: userTab === 'admins' }]" @click="switchToAdmins">🛡️ 管理员</button>
            </div>

            <!-- 普通用户 tab -->
            <div v-if="userTab === 'users'">
              <table class="detail-table">
                <thead>
                  <tr><th>ID</th><th>用户名</th><th>邮箱</th><th>银币</th><th>金币</th><th>钻石</th><th>操作</th></tr>
                </thead>
                <tbody>
                  <tr v-for="u in hubUsers" :key="u.id">
                    <td>{{ u.id }}</td>
                    <td>{{ u.name }}</td>
                    <td>{{ u.email }}</td>
                    <td>{{ u.currencies?.silver_coin || 0 }}</td>
                    <td>{{ u.currencies?.gold_coin || 0 }}</td>
                    <td>{{ u.currencies?.diamond || 0 }}</td>
                    <td>
                      <button class="action-btn-sm" @click="editUser(u)">编辑</button>
                      <button class="action-btn-sm" @click="viewUserBackpack(u)">背包</button>
                      <button class="action-btn-sm danger" @click="deleteUser(u.id)">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 管理员 tab -->
            <div v-if="userTab === 'admins'">
              <div class="detail-toolbar">
                <span></span>
                <button class="add-btn" @click="showAddAdmin = true">+ 添加管理员</button>
              </div>
              <table class="detail-table">
                <thead>
                  <tr><th>ID</th><th>邮箱</th><th>操作</th></tr>
                </thead>
                <tbody>
                  <tr v-for="a in hubAdmins" :key="a.id">
                    <td>{{ a.id }}</td>
                    <td>{{ a.email }}</td>
                    <td>
                      <button class="action-btn-sm" @click="openEditAdminEmail(a)">编辑邮箱</button>
                      <button class="action-btn-sm" @click="openChangePassword(a)">修改密码</button>
                      <button class="action-btn-sm danger" @click="deleteAdmin(a.id)">删除</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 编辑用户弹窗 -->
            <div v-if="showEditUser" class="modal-overlay" @mousedown.self="showEditUser = false">
              <div class="modal-card">
                <h3>编辑用户</h3>
                <div class="form-grid">
                  <label>用户名 <input v-model="editUserForm.name" /></label>
                  <label>邮箱 <input v-model="editUserForm.email" /></label>
                </div>
                <div class="form-group" style="margin-top:16px;">
                  <div style="font-weight:600;margin-bottom:10px;">货币余额</div>
                  <div style="display:flex;flex-direction:column;gap:8px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="min-width:60px;">银币</span>
                      <span style="display:flex;align-items:center;gap:4px;">
                        <button class="num-btn" @click="editUserForm.silver_coin = Math.max(0, editUserForm.silver_coin - 100)" type="button">−</button>
                        <input type="number" v-model.number="editUserForm.silver_coin" min="0" style="width:120px;padding:6px 10px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#e6edf3;" />
                        <button class="num-btn" @click="editUserForm.silver_coin = Number(editUserForm.silver_coin) + 100" type="button">+</button>
                      </span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="min-width:60px;">金币</span>
                      <span style="display:flex;align-items:center;gap:4px;">
                        <button class="num-btn" @click="editUserForm.gold_coin = Math.max(0, editUserForm.gold_coin - 100)" type="button">−</button>
                        <input type="number" v-model.number="editUserForm.gold_coin" min="0" style="width:120px;padding:6px 10px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#e6edf3;" />
                        <button class="num-btn" @click="editUserForm.gold_coin = Number(editUserForm.gold_coin) + 100" type="button">+</button>
                      </span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span style="min-width:60px;">钻石</span>
                      <span style="display:flex;align-items:center;gap:4px;">
                        <button class="num-btn" @click="editUserForm.diamond = Math.max(0, editUserForm.diamond - 100)" type="button">−</button>
                        <input type="number" v-model.number="editUserForm.diamond" min="0" style="width:120px;padding:6px 10px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#e6edf3;" />
                        <button class="num-btn" @click="editUserForm.diamond = Number(editUserForm.diamond) + 100" type="button">+</button>
                      </span>
                    </div>
                  </div>
                </div>
                <div class="modal-actions">
                  <button @click="showEditUser = false">取消</button>
                  <button class="primary" @click="saveUser">保存</button>
                </div>
              </div>
            </div>

            <!-- 添加管理员弹窗 -->
            <div v-if="showAddAdmin" class="modal-overlay" @mousedown.self="showAddAdmin = false">
              <div class="modal-card">
                <h3>添加管理员</h3>
                <div class="form-grid" style="grid-template-columns:1fr;">
                  <label>邮箱 <input v-model="newAdminForm.email" type="email" placeholder="admin@example.com" /></label>
                  <label>密码 <input v-model="newAdminForm.password" type="password" placeholder="至少6位" /></label>
                </div>
                <div class="modal-actions">
                  <button @click="showAddAdmin = false">取消</button>
                  <button class="primary" @click="addAdmin">添加</button>
                </div>
              </div>
            </div>

            <!-- 编辑管理员邮箱弹窗 -->
            <div v-if="showEditAdminEmail" class="modal-overlay" @mousedown.self="showEditAdminEmail = false">
              <div class="modal-card">
                <h3>编辑邮箱</h3>
                <div class="form-grid" style="grid-template-columns:1fr;">
                  <label>邮箱 <input v-model="editAdminEmailForm.email" type="email" /></label>
                </div>
                <div class="modal-actions">
                  <button @click="showEditAdminEmail = false">取消</button>
                  <button class="primary" @click="saveAdminEmail">保存</button>
                </div>
              </div>
            </div>

            <!-- 修改管理员密码弹窗 -->
            <div v-if="showChangePasswordModal" class="modal-overlay" @mousedown.self="showChangePasswordModal = false">
              <div class="modal-card">
                <h3>修改密码</h3>
                <div class="form-grid" style="grid-template-columns:1fr;">
                  <label>新密码 <input v-model="changePasswordForm.newPassword" type="password" placeholder="请输入新密码" /></label>
                  <label>确认新密码 <input v-model="changePasswordForm.confirmNewPassword" type="password" placeholder="请再次输入新密码" /></label>
                </div>
                <div class="modal-actions">
                  <button @click="showChangePasswordModal = false">取消</button>
                  <button class="primary" @click="saveChangePassword">保存</button>
                </div>
              </div>
            </div>

            <!-- 用户背包弹窗 -->
            <div v-if="showUserBackpack" class="modal-overlay" @mousedown.self="closeUserBackpack">
              <div class="modal-card" style="max-width:800px;max-height:80vh;display:flex;flex-direction:column;">
                <h3>📦 {{ currentBackpackUser?.name || '用户' }} 的背包</h3>
                <div v-if="loadingBackpack" style="text-align:center;padding:20px;">加载中...</div>
                <div v-else style="overflow-y:auto;flex:1;">
                  <h4 style="margin:10px 0;">🌱 物品（种子/作物/宠物粮/肥料）</h4>
                  <table class="detail-table" v-if="userBackpack.items.length > 0">
                    <thead>
                      <tr><th>图标</th><th>名称</th><th>类型</th><th>稀有度</th><th>数量</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="i in userBackpack.items" :key="i.item_id">
                        <td>{{ i.icon }}</td>
                        <td>{{ i.name }}</td>
                        <td>{{ itemTypeName(i.item_type) }}</td>
                        <td>{{ i.rarity }}</td>
                        <td><input type="number" :value="i.quantity" @change="(e) => updateUserItemQuantity(i.item_id, e.target.value)" style="width:80px;padding:4px 8px;border:1px solid #30363d;border-radius:4px;background:#0d1117;color:#e6edf3;" /></td>
                        <td><button class="action-btn-sm" @click="updateUserItemQuantity(i.item_id, 0)">清空</button></td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else style="text-align:center;padding:15px;color:var(--text-muted,#8b949e);">暂无物品</div>

                  <h4 style="margin:20px 0 10px 0;">🐾 宠物</h4>
                  <table class="detail-table" v-if="userBackpack.pets.length > 0">
                    <thead>
                      <tr><th>图标</th><th>名称</th><th>稀有度</th><th>等级</th><th>饥饿值</th><th>是否激活</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="p in userBackpack.pets" :key="p.user_pet_id">
                        <td>{{ p.icon }}</td>
                        <td>{{ p.name }}</td>
                        <td>{{ p.rarity }}</td>
                        <td>{{ p.level }}</td>
                        <td>{{ p.hunger }}</td>
                        <td>{{ p.is_active ? '✅ 激活' : '❌ 未激活' }}</td>
                        <td><button class="action-btn-sm danger" @click="removeUserPet(p.pet_id)">移除</button></td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else style="text-align:center;padding:15px;color:var(--text-muted,#8b949e);">暂无宠物</div>

                  <h4 style="margin:20px 0 10px 0;">🎀 饰品</h4>
                  <table class="detail-table" v-if="userBackpack.decorations.length > 0">
                    <thead>
                      <tr><th>图标</th><th>名称</th><th>槽位</th><th>品质</th><th>加成</th><th>数量</th><th>操作</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="d in userBackpack.decorations" :key="d.decoration_id">
                        <td>{{ d.icon }}</td>
                        <td>{{ d.name }}</td>
                        <td>{{ d.slot_type }}</td>
                        <td>{{ d.quality }}</td>
                        <td>+{{ d.bonus }}</td>
                        <td>{{ d.quantity || 1 }}</td>
                        <td><button class="action-btn-sm danger" @click="removeUserDecoration(d.decoration_id)">移除</button></td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else style="text-align:center;padding:15px;color:var(--text-muted,#8b949e);">暂无饰品</div>
                </div>
                <div class="modal-actions">
                  <button @click="closeUserBackpack">关闭</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 订单管理 -->
          <div v-if="activeModule === 'orders'">
            <table class="detail-table">
              <thead>
                <tr><th>ID</th><th>用户</th><th>类型</th><th>货币</th><th>金额</th><th>时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="o in hubOrders" :key="o.id">
                  <td>{{ o.id }}</td>
                  <td>{{ o.user?.name || o.user_id }}</td>
                  <td>{{ typeLabel(o.type) }}</td>
                  <td>{{ currencyLabel(o.currency_type) }}</td>
                  <td :class="o.amount > 0 ? 'amount-pos' : 'amount-neg'">{{ o.amount > 0 ? '+' : '' }}{{ o.amount }}</td>
                  <td>{{ formatTime(o.created_at) }}</td>
                  <td>
                    <button class="action-btn-sm danger" @click="deleteOrder(o.id)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <!-- 分页 -->
            <div class="hub-pagination">
              <button class="page-btn" :disabled="orderPage <= 1" @click="goOrderPage(orderPage - 1)">‹ 上一页</button>
              <span class="page-info">{{ orderPage }} / {{ orderTotalPages }}</span>
              <button class="page-btn" :disabled="orderPage >= orderTotalPages" @click="goOrderPage(orderPage + 1)">下一页 ›</button>
            </div>
          </div>

          <!-- 宠物管理 -->
          <div v-if="activeModule === 'pets'">
            <PetsPanel />
          </div>

          <!-- 全局配置 -->
          <div v-if="activeModule === 'config'">
            <ConfigPanel />
          </div>

          <!-- 特效管理 -->
          <div v-if="activeModule === 'effects'">
            <div class="detail-toolbar">
              <span></span>
              <button class="add-btn" @click="triggerUpload">+ 上传特效</button>
              <input type="file" ref="effectFileInput" accept=".js" style="display:none" @change="handleEffectUpload" />
            </div>
            <div v-if="loadingEffects" style="text-align:center;padding:20px;color:var(--text-muted,#8b949e);">加载中...</div>
            <div v-else-if="hubEffects.length === 0" style="text-align:center;padding:30px;color:var(--text-muted,#8b949e);">暂无特效文件</div>
            <table v-else class="detail-table">
              <thead>
                <tr><th>图标</th><th>名称</th><th>文件名</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="eff in hubEffects" :key="eff.filename">
                  <td>{{ eff.icon || '✨' }}</td>
                  <td>{{ eff.name }}</td>
                  <td style="color:var(--text-muted,#8b949e);font-size:11px;">{{ eff.filename }}</td>
                  <td>
                    <span v-if="eff.builtin" class="builtin-tag" style="font-size:11px;padding:2px 8px;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:6px;">默认</span>
                    <button class="action-btn-sm" @click="viewEffect(eff)">查看</button>
                    <button v-if="!eff.builtin" class="action-btn-sm danger" @click="deleteEffect(eff)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="effectUploadError" style="margin-top:8px;color:#f87171;font-size:12px;">{{ effectUploadError }}</div>

            <!-- 代码编辑弹窗 -->
            <div v-if="showEffectEditor" class="modal-overlay" @mousedown.self="showEffectEditor = false">
              <div class="modal-card wide-modal" style="width:700px;max-width:90vw;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                  <h3 style="margin:0;color:#f59e0b;">{{ editingEffect?.filename }}</h3>
                  <span v-if="editingEffect?.builtin" style="font-size:11px;padding:4px 10px;background:rgba(245,158,11,0.15);color:#f59e0b;border-radius:6px;">默认</span>
                  <button class="action-btn-sm" @click="showEffectEditor = false">✕</button>
                </div>
                <textarea
                  v-model="editorContent"
                  :readonly="editingEffect?.builtin"
                  spellcheck="false"
                  style="width:100%;height:300px;font-family:monospace;font-size:12px;background:rgba(0,0,0,0.3);color:#e6e8eb;border:1px solid var(--border-color,#334155);border-radius:6px;padding:12px;resize:vertical;"
                ></textarea>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
                  <span style="font-size:12px;color:var(--text-muted,#8b949e);">{{ editingEffect?.builtin ? '内置特效为只读，不可修改' : '修改后点击保存生效' }}</span>
                  <div style="display:flex;gap:10px;">
                    <button class="action-btn-sm" @click="showEffectEditor = false">关闭</button>
                    <button v-if="!editingEffect?.builtin" class="action-btn-sm primary" :disabled="savingEffect" @click="saveEffect">
                      {{ savingEffect ? '保存中...' : '💾 保存' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 统计 -->
          <div v-if="activeModule === 'stats'">
            <StatsPanel />
            <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border-color,#334155);">
              <h3 style="color:#ef4444;font-size:0.95rem;margin:0 0 12px 0;">⚠️ 危险操作</h3>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:10px;gap:12px;">
                <div>
                  <p style="margin:0;font-weight:600;font-size:0.9rem;">快速重置</p>
                  <p style="margin:4px 0 0 0;color:var(--text-muted,#8b949e);font-size:0.75rem;">清空所有数据并重建，创建两个演示账号</p>
                </div>
                <button class="add-btn" style="background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.4);color:#ef4444;" @click="showResetConfirm = true">重置数据库</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
      <!-- ConfirmModals -->
      <ConfirmModal
        :visible="showDeletePetConfirm"
        title="删除确认"
        message="确定删除此宠物？"
        icon="🗑️"
        confirm-text="确认删除"
        cancel-text="取消"
        :danger="true"
        @confirm="doDeletePet"
        @cancel="showDeletePetConfirm = false; pendingDeletePetId = null"
      />
      <ConfirmModal
        :visible="showDeleteDecConfirm"
        title="删除确认"
        message="确定删除此饰品？"
        icon="🗑️"
        confirm-text="确认删除"
        cancel-text="取消"
        :danger="true"
        @confirm="doDeleteDecoration"
        @cancel="showDeleteDecConfirm = false; pendingDeleteDecId = null"
      />
      <ConfirmModal
        :visible="showRemoveUserPetConfirm"
        title="移除确认"
        message="确定移除该用户的此宠物？"
        icon="🐾"
        confirm-text="确认移除"
        cancel-text="取消"
        :danger="true"
        @confirm="doRemoveUserPet"
        @cancel="showRemoveUserPetConfirm = false; pendingRemoveUserPetId = null"
      />
      <ConfirmModal
        :visible="showRemoveUserDecConfirm"
        title="移除确认"
        message="确定移除该用户的此饰品？"
        icon="🎀"
        confirm-text="确认移除"
        cancel-text="取消"
        :danger="true"
        @confirm="doRemoveUserDecoration"
        @cancel="showRemoveUserDecConfirm = false; pendingRemoveUserDecId = null"
      />
      <ConfirmModal
        :visible="showDeleteEffectConfirm"
        title="删除确认"
        :message="'确定删除特效 ' + (pendingDeleteEffect?.name || '') + ' ？'"
        icon="🗑️"
        confirm-text="确认删除"
        cancel-text="取消"
        :danger="true"
        @confirm="doDeleteEffect"
        @cancel="showDeleteEffectConfirm = false; pendingDeleteEffect = null"
      />
      <ConfirmModal
        :visible="showDeleteItemConfirm"
        title="删除确认"
        message="确定删除此物品？"
        icon="🗑️"
        confirm-text="确认删除"
        cancel-text="取消"
        :danger="true"
        @confirm="doDeleteItem"
        @cancel="showDeleteItemConfirm = false; pendingDeleteItemId = null"
      />
      <ConfirmModal
        :visible="showDeleteUserConfirm"
        title="删除确认"
        message="确定删除此用户？"
        icon="⚠️"
        confirm-text="确认删除"
        cancel-text="取消"
        :danger="true"
        @confirm="doDeleteUser"
        @cancel="showDeleteUserConfirm = false; pendingDeleteUserId = null"
      />
      <ConfirmModal
        :visible="showDeleteAdminConfirm"
        title="删除确认"
        message="确定删除此管理员？"
        icon="⚠️"
        confirm-text="确认删除"
        cancel-text="取消"
        :danger="true"
        @confirm="doDeleteAdmin"
        @cancel="showDeleteAdminConfirm = false; pendingDeleteAdminId = null"
      />
      <ConfirmModal
        :visible="showDeleteOrderConfirm"
        title="删除确认"
        message="确定删除此订单？"
        icon="🗑️"
        confirm-text="确认删除"
        cancel-text="取消"
        :danger="true"
        @confirm="doDeleteOrder"
        @cancel="showDeleteOrderConfirm = false; pendingDeleteOrderId = null"
      />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeStore } from '@/stores/themeStore'
import PetsPanel from './PetsPanel.vue'
import ConfigPanel from './ConfigPanel.vue'
import StatsPanel from './StatsPanel.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'

const router = useRouter()
const themeStore = useThemeStore()

const hubRef = ref(null)
const activeModule = ref(null)
const centerExpanded = ref(false)
const showLogoutConfirm = ref(false)
const showResetConfirm = ref(false)
const itemFilter = ref('all')
const userTab = ref('users')

// CRUD 状态
const showAddItem = ref(false)
const showEditItem = ref(false)
const showEditUser = ref(false)
const showAddAdmin = ref(false)
const showEditAdminEmail = ref(false)
const editAdminEmailForm = ref({ id: null, email: '' })
const showChangePasswordModal = ref(false)
const changePasswordForm = ref({ id: null, email: '', newPassword: '', confirmNewPassword: '' })
const editItemForm = ref({})
const editUserForm = ref({})
const newItemForm = ref({ name: '', icon: '', item_type: 'seed', rarity: 'C', buy_price: 0, sell_price: 0, base_yield: 0, currency_type: 'silver_coin', is_shop: true, purchasable: true })
const newAdminForm = ref({ email: '', password: '' })
const effectFileInput = ref(null)
const effectUploadError = ref('')
const loadingEffects = ref(false)
const BUILTIN_EFFECTS = ['bubble-fish.js', 'cat-paw.js', 'star-rabbit.js', 'thunder-eagle.js', 'crystal-dragon.js', 'lbooktest.js']
const showEffectEditor = ref(false)
const editingEffect = ref(null)
const editorContent = ref('')
const savingEffect = ref(false)

// 物品/宠物/饰品 tab 相关
const hubItemTab = ref('items')
const showAddPet = ref(false)
const showEditPet = ref(false)
const showAddDec = ref(false)
const showEditDec = ref(false)
const editPetForm = ref({})
const newPetForm = ref({ name: '', icon: '🐾', rarity: 'C', base_bonus: 0, price_amount: 0, price_type: 'silver_coin', purchasable: true })
const editDecForm = ref({})
const newDecForm = ref({ name: '', icon: '🎀', slot_type: 'head', quality: 'C', bonus: 0, price_type: 'silver_coin', price_amount: 0, pet_id: null })

// 用户背包相关
const showUserBackpack = ref(false)
const currentBackpackUser = ref(null)
const userBackpack = ref({ items: [], pets: [], decorations: [] })
const loadingBackpack = ref(false)

// Hub data
const hubItems = ref([])
const hubUsers = ref([])
const hubOrders = ref([])
const orderPage = ref(1)
const orderTotalPages = ref(1)
const hubAdmins = ref([])
const hubEffects = ref([])
const hubPets = ref([])
const hubDecorations = ref([])
const loadingItems = ref(false)
const loadingPets = ref(false)
const loadingDecs = ref(false)

// ConfirmModal refs
const showDeletePetConfirm = ref(false)
const pendingDeletePetId = ref(null)
const showDeleteDecConfirm = ref(false)
const pendingDeleteDecId = ref(null)
const showRemoveUserPetConfirm = ref(false)
const pendingRemoveUserPetId = ref(null)
const showRemoveUserDecConfirm = ref(false)
const pendingRemoveUserDecId = ref(null)
const showDeleteEffectConfirm = ref(false)
const pendingDeleteEffect = ref(null)
const showDeleteItemConfirm = ref(false)
const pendingDeleteItemId = ref(null)
const showDeleteUserConfirm = ref(false)
const pendingDeleteUserId = ref(null)
const showDeleteAdminConfirm = ref(false)
const pendingDeleteAdminId = ref(null)
const showDeleteOrderConfirm = ref(false)
const pendingDeleteOrderId = ref(null)

// 模块按钮 refs
const moduleRefs = ref({})

// 8 个模块按钮（含退出）
const moduleDefs = [
  { id: 'items',   icon: '📦', label: '物品' },
  { id: 'pets',    icon: '🐾', label: '宠物' },
  { id: 'users',   icon: '👥', label: '用户' },
  { id: 'orders',  icon: '📋', label: '订单' },
  { id: 'config',  icon: '⚙️', label: '配置' },
  { id: 'effects', icon: '✨', label: '特效' },
  { id: 'stats',   icon: '📊', label: '统计', action: () => openStats() },
  { id: 'exit',    icon: '🚪', label: '退出', action: () => confirmLogout() },
]

// 计算 8 个按钮均匀分布在圆周上的位置
const CIRCLE_RADIUS = 30 // vh
const allModules = computed(() => {
  const count = moduleDefs.length
  return moduleDefs.map((def, i) => {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2 // 从顶部开始顺时针
    const ox = (Math.cos(angle) * CIRCLE_RADIUS).toFixed(1) + 'vh'
    const oy = (Math.sin(angle) * CIRCLE_RADIUS).toFixed(1) + 'vh'
    return { ...def, ox, oy }
  })
})

// 动态连线数据
const dynamicLines = ref([])
let resizeObserver = null

function calcLines() {
  if (!hubRef.value || !centerExpanded.value) return
  const container = hubRef.value
  const containerRect = container.getBoundingClientRect()
  const centerX = containerRect.width / 2
  const centerY = containerRect.height / 2

  const lines = []
  for (let i = 0; i < moduleDefs.length; i++) {
    const el = moduleRefs.value[i]
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const modCenterX = rect.left - containerRect.left + rect.width / 2
    const modCenterY = rect.top - containerRect.top + rect.height / 2
    lines.push({ x1: centerX, y1: centerY, x2: modCenterX, y2: modCenterY })
  }
  dynamicLines.value = lines
}

watch(centerExpanded, async (val) => {
  if (val) {
    await nextTick()
    // 等按钮展开动画完成后再计算连线
    setTimeout(calcLines, 500)
    setTimeout(calcLines, 800)
  }
})

onMounted(() => {
  themeStore.init()
  resizeObserver = new ResizeObserver(() => {
    if (centerExpanded.value) calcLines()
  })
  if (hubRef.value) resizeObserver.observe(hubRef.value)
  window.addEventListener('resize', calcLines)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', calcLines)
})

const currentModuleTitle = computed(() => {
  const mod = moduleDefs.find(m => m.id === activeModule.value)
  if (mod) return `${mod.icon} ${mod.label}管理`
  if (activeModule.value === 'stats') return '📊 统计'
  return ''
})

const filteredItems = computed(() => {
  if (itemFilter.value === 'all') return hubItems.value
  return hubItems.value.filter(i => i.item_type === itemFilter.value)
})

function itemTypeName(type) {
  const map = { seed: '🌱 种子', crop: '🌾 作物', fertilizer: '🧪 肥料', pet_food: '🍖 宠物粮' }
  return map[type] || type
}

function currencyName(type) {
  const map = { silver_coin: '🪙 银币', gold_coin: '🥇 金币', diamond: '💎 钻石' }
  return map[type] || type
}

// Tab 切换
function switchHubItemTab(tab) {
  hubItemTab.value = tab
  if (tab === 'pets' && hubPets.value.length === 0) {
    loadHubPets()
  } else if (tab === 'decorations' && hubDecorations.value.length === 0) {
    loadHubDecorations()
  } else if (tab === 'items' && hubItems.value.length === 0) {
    loadHubItems()
  }
}

// 加载物品
async function loadHubItems() {
  loadingItems.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/items/all`, { headers: { Authorization: `Bearer ${token}` } })
    hubItems.value = await r.json()
  } catch (e) { console.error('Failed to load hub items:', e) }
  finally { loadingItems.value = false }
}

// 加载宠物（按 ID 升序排序）
async function loadHubPets() {
  loadingPets.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/pets/all`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) {
      const data = await r.json()
      hubPets.value = data.sort((a, b) => Number(a.id) - Number(b.id))
    }
  } catch (e) { console.error('Failed to load hub pets:', e) }
  finally { loadingPets.value = false }
}

// 加载饰品（按 ID 升序排序）
async function loadHubDecorations() {
  loadingDecs.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/decorations/all`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) {
      const data = await r.json()
      hubDecorations.value = Array.isArray(data) ? data.sort((a, b) => Number(a.id) - Number(b.id)) : []
    }
  } catch (e) { console.error('Failed to load hub decorations:', e) }
  finally { loadingDecs.value = false }
}

// 宠物 CRUD
function editPet(pet) {
  editPetForm.value = { id: pet.id, name: pet.name, icon: pet.icon, rarity: pet.rarity, base_bonus: pet.base_bonus, price_amount: pet.price_amount, price_type: pet.price_type, purchasable: pet.purchasable }
  showEditPet.value = true
}

async function savePet() {
  try {
    const token = localStorage.getItem('auth_token')
    const id = editPetForm.value.id
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/pets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(editPetForm.value)
    })
    if (r.ok) {
      const updated = await r.json()
      const idx = hubPets.value.findIndex(p => p.id === id)
      if (idx !== -1) hubPets.value[idx] = updated
      showEditPet.value = false
    } else {
      const err = await r.json()
      alert(err.error || '保存宠物失败')
    }
  } catch (e) { console.error('Failed to save pet:', e) }
}

async function addPet() {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/pets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newPetForm.value)
    })
    if (r.ok) {
      const data = await r.json()
      hubPets.value.push(data)
      showAddPet.value = false
      newPetForm.value = { name: '', icon: '🐾', rarity: 'C', base_bonus: 0, price_amount: 0, price_type: 'silver_coin', purchasable: true }
    }
  } catch (e) { console.error('Failed to add pet:', e) }
}

async function deletePet(petId) {
  pendingDeletePetId.value = petId
  showDeletePetConfirm.value = true
}
async function doDeletePet() {
  const petId = pendingDeletePetId.value
  showDeletePetConfirm.value = false
  pendingDeletePetId.value = null
  if (!petId) return
  try {
    const token = localStorage.getItem('auth_token')
    await fetch(`${import.meta.env.VITE_API_URL}/admin/pets/${petId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    })
    hubPets.value = hubPets.value.filter(p => p.id !== petId)
  } catch (e) { console.error('Failed to delete pet:', e) }
}

// 饰品 CRUD
function editDecoration(dec) {
  editDecForm.value = { id: dec.id, name: dec.name, icon: dec.icon, slot_type: dec.slot_type, quality: dec.quality, bonus: Number(dec.bonus), price_type: dec.price_type, price_amount: dec.price_amount, pet_id: dec.pet_id }
  showEditDec.value = true
}

async function saveDecoration() {
  try {
    const token = localStorage.getItem('auth_token')
    const id = editDecForm.value.id
    const payload = { ...editDecForm.value }
    delete payload.id
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/decorations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    })
    if (r.ok) {
      const updated = await r.json()
      const idx = hubDecorations.value.findIndex(d => d.id === id)
      if (idx !== -1) hubDecorations.value[idx] = updated
      showEditDec.value = false
    }
  } catch (e) { console.error('Failed to save decoration:', e) }
}

async function addDecoration() {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/decorations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newDecForm.value)
    })
    if (r.ok) {
      const data = await r.json()
      hubDecorations.value.push(data)
      showAddDec.value = false
      newDecForm.value = { name: '', icon: '🎀', slot_type: 'head', quality: 'C', bonus: 0, price_type: 'silver_coin', price_amount: 0, pet_id: null }
    }
  } catch (e) { console.error('Failed to add decoration:', e) }
}

async function deleteDecoration(decId) {
  pendingDeleteDecId.value = decId
  showDeleteDecConfirm.value = true
}
async function doDeleteDecoration() {
  const decId = pendingDeleteDecId.value
  showDeleteDecConfirm.value = false
  pendingDeleteDecId.value = null
  if (!decId) return
  try {
    const token = localStorage.getItem('auth_token')
    await fetch(`${import.meta.env.VITE_API_URL}/admin/decorations/${decId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    })
    hubDecorations.value = hubDecorations.value.filter(d => d.id !== decId)
  } catch (e) { console.error('Failed to delete decoration:', e) }
}

// ========== 用户背包 ==========
async function viewUserBackpack(user) {
  currentBackpackUser.value = user
  showUserBackpack.value = true
  loadingBackpack.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${user.id}/backpack`, { headers: { Authorization: `Bearer ${token}` } })
    if (r.ok) {
      const data = await r.json()
      console.log('User backpack API response:', data)
      userBackpack.value = {
        items: (data.items || []).map(i => ({ ...i })),
        pets: (data.pets || []).map(p => ({ ...p })),
        decorations: (data.decorations || []).map(d => ({ ...d }))
      }
      console.log('Updated userBackpack:', userBackpack.value)
    } else {
      const err = await r.json()
      console.error('Failed to fetch user backpack:', err)
      alert(err.error || '获取用户背包失败')
    }
  } catch (e) { console.error('Failed to load user backpack:', e) }
  finally { loadingBackpack.value = false }
}

function closeUserBackpack() {
  showUserBackpack.value = false
  currentBackpackUser.value = null
  userBackpack.value = { items: [], pets: [], decorations: [] }
}

// 调整用户物品数量
async function updateUserItemQuantity(itemId, newQuantity) {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${currentBackpackUser.value.id}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ item_id: itemId, quantity: Number(newQuantity) })
    })
    if (r.ok) {
      const finalQuantity = Number(newQuantity)
      const idx = userBackpack.value.items.findIndex(i => i.item_id === itemId)
      if (idx !== -1) {
        if (finalQuantity === 0) {
          userBackpack.value.items.splice(idx, 1)
        } else {
          userBackpack.value.items[idx].quantity = finalQuantity
        }
      }
    } else {
      alert('更新失败')
    }
  } catch (e) { console.error('Failed to update item quantity:', e) }
}

// 删除用户宠物（使用 pet_id，因为后端是按 user_id + pet_id 删除）
async function removeUserPet(petId) {
  pendingRemoveUserPetId.value = petId
  showRemoveUserPetConfirm.value = true
}
async function doRemoveUserPet() {
  const petId = pendingRemoveUserPetId.value
  showRemoveUserPetConfirm.value = false
  pendingRemoveUserPetId.value = null
  if (!petId) return
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${currentBackpackUser.value.id}/pets/${petId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const idx = userBackpack.value.pets.findIndex(p => p.pet_id === petId)
      if (idx !== -1) userBackpack.value.pets.splice(idx, 1)
    }
  } catch (e) { console.error('Failed to remove user pet:', e) }
}

// 删除用户饰品
async function removeUserDecoration(decId) {
  pendingRemoveUserDecId.value = decId
  showRemoveUserDecConfirm.value = true
}
async function doRemoveUserDecoration() {
  const decId = pendingRemoveUserDecId.value
  showRemoveUserDecConfirm.value = false
  pendingRemoveUserDecId.value = null
  if (!decId) return
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${currentBackpackUser.value.id}/decorations/${decId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const idx = userBackpack.value.decorations.findIndex(d => d.decoration_id === decId)
      if (idx !== -1) userBackpack.value.decorations.splice(idx, 1)
    }
  } catch (e) { console.error('Failed to remove user decoration:', e) }
}

function typeLabel(type) {
  const map = { purchase: '购买', refund: '退款', gift: '赠送', reward: '奖励', admin: '管理' }
  return map[type] || type || '—'
}

function currencyLabel(type) {
  const map = { silver_coin: '银币', gold_coin: '金币', diamond: '钻石' }
  return map[type] || type || '—'
}

function formatTime(t) {
  if (!t) return ''
  return new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// 中心按钮
function toggleCenter() {
  centerExpanded.value = !centerExpanded.value
}

function openStats() {
  activeModule.value = 'stats'
}

function confirmLogout() {
  showLogoutConfirm.value = true
}

function triggerUpload() {
  effectFileInput.value?.click()
}

async function handleEffectUpload(e) {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.name.endsWith('.js')) {
    effectUploadError.value = '请选择 .js 文件'
    return
  }
  effectUploadError.value = ''
  try {
    const content = await file.text()
    if (!content.includes('name') || !content.includes('init')) {
      effectUploadError.value = '文件必须导出 { name, init } 对象'
      return
    }
    const token = localStorage.getItem('auth_token')
    const formData = new FormData()
    formData.append('effect', file)
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    })
    if (r.ok) {
      hubEffects.value = []
      await loadEffects()
    } else {
      const err = await r.json()
      effectUploadError.value = err.error || '上传失败'
    }
  } catch {
    effectUploadError.value = '网络错误'
  }
  if (effectFileInput.value) effectFileInput.value.value = ''
}

async function loadEffects() {
  loadingEffects.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      const files = data.effects || data
      hubEffects.value = files.map(f => ({ filename: f, name: f.replace('.js', ''), icon: '✨', builtin: BUILTIN_EFFECTS.includes(f) }))
    }
  } catch (e) {
    console.error('Failed to load effects:', e)
  } finally {
    loadingEffects.value = false
  }
}

async function viewEffect(eff) {
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/${eff.filename}/content`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      editingEffect.value = { ...eff, builtin: data.builtin }
      editorContent.value = data.content
      showEffectEditor.value = true
    }
  } catch (e) {
    console.error('Failed to load effect content:', e)
  }
}

async function saveEffect() {
  if (!editingEffect.value) return
  savingEffect.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/${editingEffect.value.filename}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ content: editorContent.value })
    })
    if (r.ok) {
      showEffectEditor.value = false
    }
  } catch (e) {
    console.error('Save error:', e)
  } finally {
    savingEffect.value = false
  }
}

async function deleteEffect(eff) {
  if (eff.builtin) return
  pendingDeleteEffect.value = eff
  showDeleteEffectConfirm.value = true
}
async function doDeleteEffect() {
  const eff = pendingDeleteEffect.value
  showDeleteEffectConfirm.value = false
  pendingDeleteEffect.value = null
  if (!eff) return
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/effects/${eff.filename}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      await loadEffects()
    }
  } catch (e) {
    console.error('Delete error:', e)
  }
}

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_role')
  localStorage.removeItem('user_email')
  localStorage.removeItem('user_name')
  localStorage.removeItem('user_key')
  showLogoutConfirm.value = false
  router.push('/')
}

async function doReset() {
  showResetConfirm.value = false
  try {
    const token = localStorage.getItem('auth_token')
    const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/reset`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
    if (r.ok) {
      const data = await r.json()
      alert('重置成功！\n演示账号：' + data.accounts.map(a => `${a.email} / ${a.password}`).join('\n'))
    } else {
      const err = await r.json()
      alert(err.error || '重置失败')
    }
  } catch (e) {
    alert('网络错误')
  }
}

async function openModule(id) {
  // 不收起按钮，保持展开状态
  activeModule.value = id
  const token = localStorage.getItem('auth_token')
  try {
    if (id === 'items' && hubItems.value.length === 0) {
      loadHubItems()
    }
    if (id === 'users') {
      userTab.value = 'users'
      if (hubUsers.value.length === 0) {
        const r = await fetch(`${import.meta.env.VITE_API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
        const all = await r.json()
        hubUsers.value = all.filter(u => u.role !== 'admin')
      }
    }
    if (id === 'orders') {
      await loadOrders(1)
    }
    if (id === 'effects' && hubEffects.value.length === 0) {
      await loadEffects()
    }
  } catch (e) {
    console.error('Failed to load hub data:', e)
  }
}

async function switchToAdmins() {
  userTab.value = 'admins'
  if (hubAdmins.value.length === 0) {
    try {
      const token = localStorage.getItem('auth_token')
      const r = await fetch(`${import.meta.env.VITE_API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })
      const all = await r.json()
      hubAdmins.value = all.filter(u => u.role === 'admin')
    } catch (e) {
      console.error('Failed to load admins:', e)
    }
  }
}

function closeModule() { activeModule.value = null }

function switchToClassic() {
  themeStore.setAdminTheme('classic')
  router.push('/admin/classic/dashboard')
}

// ========== 物品 CRUD ==========
function editItem(item) {
  editItemForm.value = { ...item }
  showEditItem.value = true
}

async function saveItem() {
  const token = localStorage.getItem('auth_token')
  const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/items/${editItemForm.value.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(editItemForm.value)
  })
  if (r.ok) {
    const idx = hubItems.value.findIndex(i => i.id === editItemForm.value.id)
    if (idx !== -1) hubItems.value[idx] = { ...editItemForm.value }
    showEditItem.value = false
  }
}

async function addItem() {
  const token = localStorage.getItem('auth_token')
  const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(newItemForm.value)
  })
  if (r.ok) {
    const data = await r.json()
    hubItems.value.push(data)
    showAddItem.value = false
    newItemForm.value = { name: '', icon: '', item_type: 'seed', rarity: 'C', buy_price: 0, sell_price: 0, base_yield: 0, currency_type: 'silver_coin' }
  }
}

async function deleteItem(id) {
  pendingDeleteItemId.value = id
  showDeleteItemConfirm.value = true
}
async function doDeleteItem() {
  const id = pendingDeleteItemId.value
  showDeleteItemConfirm.value = false
  pendingDeleteItemId.value = null
  if (!id) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/admin/items/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubItems.value = hubItems.value.filter(i => i.id !== id)
}

// ========== 用户 CRUD ==========
function editUser(user) {
  editUserForm.value = {
    id: user.id,
    name: user.name,
    email: user.email,
    silver_coin: user.currencies?.silver_coin || 0,
    gold_coin: user.currencies?.gold_coin || 0,
    diamond: user.currencies?.diamond || 0
  }
  showEditUser.value = true
}

async function saveUser() {
  const token = localStorage.getItem('auth_token')
  // 1. 更新用户名和邮箱
  const r = await fetch(`${import.meta.env.VITE_API_URL}/users/${editUserForm.value.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: editUserForm.value.name,
      email: editUserForm.value.email
    })
  })
  // 2. 更新货币
  const curR = await fetch(`${import.meta.env.VITE_API_URL}/admin/users/${editUserForm.value.id}/currencies`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      silver_coin: editUserForm.value.silver_coin,
      gold_coin: editUserForm.value.gold_coin,
      diamond: editUserForm.value.diamond
    })
  })
  if (r.ok && curR.ok) {
    const idx = hubUsers.value.findIndex(u => u.id === editUserForm.value.id)
    if (idx !== -1) {
      hubUsers.value[idx].name = editUserForm.value.name
      hubUsers.value[idx].email = editUserForm.value.email
      hubUsers.value[idx].currencies = {
        silver_coin: editUserForm.value.silver_coin,
        gold_coin: editUserForm.value.gold_coin,
        diamond: editUserForm.value.diamond
      }
    }
    showEditUser.value = false
  }
}

async function deleteUser(id) {
  pendingDeleteUserId.value = id
  showDeleteUserConfirm.value = true
}
async function doDeleteUser() {
  const id = pendingDeleteUserId.value
  showDeleteUserConfirm.value = false
  pendingDeleteUserId.value = null
  if (!id) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubUsers.value = hubUsers.value.filter(u => u.id !== id)
}

// ========== 管理员 CRUD ==========
async function addAdmin() {
  if (!newAdminForm.value.email || !newAdminForm.value.password) return alert('请填写邮箱和密码')
  const token = localStorage.getItem('auth_token')
  const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email: newAdminForm.value.email, password: newAdminForm.value.password, role: 'admin' })
  })
  if (r.ok) {
    const data = await r.json()
    hubAdmins.value.push(data.user || data)
    showAddAdmin.value = false
    newAdminForm.value = { email: '', password: '' }
  } else {
    const err = await r.json()
    alert(err.error || '添加失败')
  }
}

function openEditAdminEmail(admin) {
  editAdminEmailForm.value = { id: admin.id, email: admin.email }
  showEditAdminEmail.value = true
}

function openChangePassword(admin) {
  changePasswordForm.value = { id: admin.id, email: admin.email, newPassword: '', confirmNewPassword: '' }
  showChangePasswordModal.value = true
}

async function saveAdminEmail() {
  try {
    const token = localStorage.getItem('auth_token')
    const { id, email } = editAdminEmailForm.value
    const r = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, name: email.split('@')[0], role: 'admin' })
    })
    if (r.ok) {
      showEditAdminEmail.value = false
      const adminsRes = await fetch(`${import.meta.env.VITE_API_URL}/admin/admins`, { headers: { Authorization: `Bearer ${token}` } })
      if (adminsRes.ok) hubAdmins.value = await adminsRes.json()
    } else {
      const err = await r.json()
      alert(err.error || '保存失败')
    }
  } catch (e) { console.error('Failed to save admin email:', e) }
}

async function saveChangePassword() {
  if (changePasswordForm.value.newPassword !== changePasswordForm.value.confirmNewPassword) {
    alert('两次输入的密码不一致')
    return
  }
  if (!changePasswordForm.value.newPassword || changePasswordForm.value.newPassword.length < 6) {
    alert('密码长度至少6位')
    return
  }
  try {
    const token = localStorage.getItem('auth_token')
    const { id, newPassword } = changePasswordForm.value
    const r = await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password: newPassword })
    })
    if (r.ok) {
      showChangePasswordModal.value = false
      alert('密码修改成功')
    } else {
      const err = await r.json()
      alert(err.error || '修改失败')
    }
  } catch (e) { console.error('Failed to change password:', e) }
}

async function deleteAdmin(id) {
  pendingDeleteAdminId.value = id
  showDeleteAdminConfirm.value = true
}
async function doDeleteAdmin() {
  const id = pendingDeleteAdminId.value
  showDeleteAdminConfirm.value = false
  pendingDeleteAdminId.value = null
  if (!id) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubAdmins.value = hubAdmins.value.filter(a => a.id !== id)
}

// ========== 订单分页 ==========
async function loadOrders(page = 1) {
  const token = localStorage.getItem('auth_token')
  const limit = window.innerWidth >= 768 ? 20 : 10
  const r = await fetch(`${import.meta.env.VITE_API_URL}/admin/orders?page=${page}&limit=${limit}`, { headers: { Authorization: `Bearer ${token}` } })
  const data = await r.json()
  hubOrders.value = data.orders || []
  orderTotalPages.value = data.pagination?.totalPages || 1
  orderPage.value = data.pagination?.page || page
}

function goOrderPage(p) {
  if (p < 1 || p > orderTotalPages.value) return
  loadOrders(p)
}

// ========== 订单删除 ==========
async function deleteOrder(id) {
  pendingDeleteOrderId.value = id
  showDeleteOrderConfirm.value = true
}
async function doDeleteOrder() {
  const id = pendingDeleteOrderId.value
  showDeleteOrderConfirm.value = false
  pendingDeleteOrderId.value = null
  if (!id) return
  const token = localStorage.getItem('auth_token')
  await fetch(`${import.meta.env.VITE_API_URL}/admin/orders/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
  hubOrders.value = hubOrders.value.filter(o => o.id !== id)
}
</script>

<style scoped>
.hub-container {
  position: relative;
  width: 100%;
  height: 100vh;
  background: var(--bg-primary, #0d1117);
  overflow: hidden;
}

.hub-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}
.hub-line {
  animation: lineFadeIn 0.4s ease forwards;
  opacity: 0;
}
@keyframes lineFadeIn {
  to { opacity: 1; }
}

/* Top bar */
.hub-top {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
}
.hub-title {
  font-size: 14px;
  color: var(--text-secondary, #8b949e);
}
.theme-switch-btn {
  background: rgba(0,255,136,0.1);
  color: #00ff88;
  border: 1px solid rgba(0,255,136,0.3);
  padding: 4px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.theme-switch-btn:hover {
  background: rgba(0,255,136,0.2);
}

/* Center hub */
.hub-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(circle, #1a3a2a, #0d2b1a);
  border: 2px solid rgba(0,255,136,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  box-shadow: 0 0 40px rgba(0,255,136,0.15);
  cursor: pointer;
  transition: all 0.3s;
  animation: centerSlideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes centerSlideUp {
  from {
    transform: translate(-50%, calc(-50% + 100vh));
    opacity: 0;
  }
  to {
    transform: translate(-50%, -50%);
    opacity: 1;
  }
}
.hub-center:hover {
  box-shadow: 0 0 60px rgba(0,255,136,0.3);
  transform: translate(-50%, -50%) scale(1.05);
}
.hub-center.expanded {
  box-shadow: 0 0 80px rgba(0,255,136,0.4);
  border-color: rgba(0,255,136,0.6);
}

/* 脉冲引导特效 */
.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid rgba(0,255,136,0.4);
  animation: pulseExpand 2s ease-out infinite;
  pointer-events: none;
}
.pulse-ring.delay {
  animation-delay: 1s;
}
@keyframes pulseExpand {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

.hub-icon {
  font-size: 36px;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hub-icon.rotated {
  transform: rotate(180deg);
}

/* Modules */
.hub-module {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border-color, #21262d);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 5;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  /* 默认隐藏在中心 */
  opacity: 0;
  transform: translate(-50%, -50%) scale(0);
  pointer-events: none;
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hub-module.visible {
  opacity: 1;
  transform: translate(calc(-50% + var(--ox)), calc(-50% + var(--oy))) scale(1);
  pointer-events: auto;
}
.hub-module:hover {
  border-color: #00ff88;
  box-shadow: 0 0 24px rgba(0,255,136,0.15);
  z-index: 20;
}
.hub-module.visible:hover {
  transform: translate(calc(-50% + var(--ox)), calc(-50% + var(--oy))) scale(1.15);
}
.hub-module.active {
  border-color: #00ff88;
  background: rgba(0,255,136,0.05);
}
.mod-icon {
  font-size: 24px;
  margin-bottom: 2px;
}
.mod-label {
  font-size: 10px;
  color: var(--text-muted, #8b949e);
}

/* Detail overlay */
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
}
.detail-card {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border-color, #21262d);
  border-radius: 16px;
  padding: 24px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  position: relative;
}
.detail-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--text-muted, #8b949e);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}
.detail-close:hover {
  background: rgba(255,255,255,0.05);
  color: var(--text-primary, #c9d1d9);
}
.detail-card h2 {
  font-size: 16px;
  color: #00ff88;
  margin: 0 0 16px 0;
}

/* User tabs */
.user-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--bg-primary, #0d1117);
  border-radius: 8px;
  padding: 4px;
}
.tab-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #8b949e);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn:hover {
  color: var(--text-primary, #c9d1d9);
  background: rgba(255,255,255,0.04);
}
.tab-btn.active {
  background: rgba(0,255,136,0.1);
  color: #00ff88;
}

/* Hub item tabs */
.hub-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--bg-primary, #0d1117);
  border-radius: 8px;
  padding: 4px;
}
.hub-tab {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted, #8b949e);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.hub-tab:hover {
  color: var(--text-primary, #c9d1d9);
  background: rgba(255,255,255,0.04);
}
.hub-tab.active {
  background: rgba(0,255,136,0.1);
  color: #00ff88;
}

/* Detail content */
.detail-body {
  font-size: 13px;
}
.detail-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.detail-select {
  padding: 6px 12px;
  background: var(--bg-tertiary, #0d1117);
  border: 1px solid var(--border-color, #21262d);
  color: var(--text-primary, #c9d1d9);
  border-radius: 6px;
  font-size: 12px;
}
.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.detail-table th {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color, #21262d);
  color: var(--text-muted, #8b949e);
  white-space: nowrap;
}
.detail-table td {
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  color: var(--text-primary, #c9d1d9);
}
.detail-table tr:hover td {
  background: rgba(255,255,255,0.02);
}

.rarity-tag {
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
}
.rarity-tag.C { background: #9e9e9e; color: #fff; }
.rarity-tag.B { background: #4caf50; color: #fff; }
.rarity-tag.A { background: #2196f3; color: #fff; }
.rarity-tag.S { background: #9c27b0; color: #fff; }
.rarity-tag.SSS { background: #ff9800; color: #fff; }

.amount-pos { color: #00ff88; font-weight: 600; }
.amount-neg { color: #f87171; font-weight: 600; }

/* Light theme */
[data-theme="light"] .hub-container {
  background: #f8fafc;
}
[data-theme="light"] .hub-center {
  background: radial-gradient(circle, #f0fdf4, #dcfce7);
}
[data-theme="light"] .hub-module {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
[data-theme="light"] .hub-module:hover {
  box-shadow: 0 0 16px rgba(0,255,136,0.15);
}
[data-theme="light"] .detail-card {
  background: #ffffff;
  border-color: #e2e8f0;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
[data-theme="light"] .detail-table th {
  color: #64748b;
}
[data-theme="light"] .detail-table td {
  color: #1e293b;
}
[data-theme="light"] .detail-overlay {
  background: rgba(0,0,0,0.3);
}
[data-theme="light"] .user-tabs {
  background: #f1f5f9;
}
[data-theme="light"] .tab-btn.active {
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

@media (max-width: 767px) {
  .hub-module {
    width: 60px;
    height: 60px;
  }
  .mod-icon { font-size: 18px; }
  .mod-label { font-size: 9px; }
  .hub-center {
    width: 70px;
    height: 70px;
  }
  .hub-icon { font-size: 28px; }
  .detail-card {
    padding: 16px;
    max-height: 85vh;
  }
}

.add-btn {
  background: rgba(0,255,136,0.1);
  border: 1px solid rgba(0,255,136,0.3);
  color: #00ff88;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}
.add-btn:hover { background: rgba(0,255,136,0.2); }

.action-btn-sm {
  padding: 3px 8px;
  border: 1px solid rgba(0,255,136,0.3);
  border-radius: 4px;
  background: rgba(0,255,136,0.08);
  color: #00ff88;
  font-size: 11px;
  cursor: pointer;
  margin-right: 4px;
}
.action-btn-sm:hover { background: rgba(0,255,136,0.15); }
.action-btn-sm.danger {
  background: rgba(220,38,38,0.1);
  border-color: rgba(220,38,38,0.3);
  color: #f87171;
}
.action-btn-sm.danger:hover { background: rgba(220,38,38,0.2); }

.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  z-index: 100; display: flex; align-items: center; justify-content: center;
}
.modal-card {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border-color, #30363d);
  border-radius: 12px; padding: 24px; width: 90%; max-width: 500px;
  max-height: 80vh; overflow-y: auto;
}
.modal-card h3 { color: #00ff88; margin: 0 0 16px 0; font-size: 15px; }
.form-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;
}
.form-grid label {
  display: flex; flex-direction: column; gap: 4px;
  font-size: 12px; color: var(--text-secondary, #8b949e);
  min-width: 0;
}
.form-grid .number-input-group {
  width: 100%;
}
.form-grid .number-input-group input[type="number"] {
  flex: 1;
  min-width: 0;
}
.form-grid input, .form-grid select {
  padding: 6px 10px; background: var(--bg-primary, #0d1117);
  border: 1px solid var(--border-color, #30363d); border-radius: 6px;
  color: var(--text-primary, #c9d1d9); font-size: 13px;
}
.form-grid input[type="checkbox"] { width: auto; }
.modal-actions {
  display: flex; justify-content: flex-end; gap: 8px;
}
.modal-actions button {
  padding: 6px 16px; border-radius: 6px; font-size: 13px;
  cursor: pointer; border: 1px solid var(--border-color, #30363d);
  background: var(--bg-tertiary, #21262d); color: var(--text-primary, #c9d1d9);
}
.modal-actions button.primary {
  background: rgba(0,255,136,0.15); border-color: #00ff88; color: #00ff88;
}
.modal-actions button:hover { opacity: 0.8; }

/* 订单分页 */
.hub-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid var(--border-color, #334155);
}
.page-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-color, #334155);
  border-radius: 6px;
  background: var(--bg-primary, #0f172a);
  color: var(--text-primary, #f1f5f9);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.page-btn:hover:not(:disabled) {
  border-color: #f59e0b;
  color: #f59e0b;
}
.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.page-info {
  font-size: 13px;
  color: var(--text-muted, #8b949e);
}

[data-theme="light"] .theme-switch-btn {
  background: rgba(22,163,74,0.1);
  color: #16a34a;
  border-color: rgba(22,163,74,0.3);
}
[data-theme="light"] .theme-switch-btn:hover {
  background: rgba(22,163,74,0.2);
}
[data-theme="light"] .hub-center {
  border-color: rgba(22,163,74,0.2);
  box-shadow: 0 0 30px rgba(22,163,74,0.08);
}
[data-theme="light"] .hub-center .hub-icon {
  color: #15803d;
  text-shadow: 0 0 20px rgba(22,163,74,0.3);
}
[data-theme="light"] .hub-module.active {
  border-color: rgba(22,163,74,0.4);
  box-shadow: 0 0 30px rgba(22,163,74,0.15);
}
[data-theme="light"] .hub-module.active .mod-icon {
  color: #16a34a;
}
[data-theme="light"] .hub-module.active .mod-label {
  color: #16a34a;
}
[data-theme="light"] .hub-module:hover {
  border-color: rgba(22,163,74,0.3);
}
[data-theme="light"] .hub-module:hover .mod-icon {
  color: #16a34a;
}
[data-theme="light"] .detail-table th {
  color: #16a34a;
}
[data-theme="light"] .add-btn {
  background: rgba(22,163,74,0.1);
  border-color: rgba(22,163,74,0.3);
  color: #16a34a;
}
[data-theme="light"] .add-btn:hover {
  background: rgba(22,163,74,0.2);
}
[data-theme="light"] .action-btn-sm {
  border-color: rgba(22,163,74,0.3);
  background: rgba(22,163,74,0.08);
  color: #16a34a;
}
[data-theme="light"] .action-btn-sm:hover {
  background: rgba(22,163,74,0.15);
}
[data-theme="light"] .modal-card h3 {
  color: #16a34a;
}
[data-theme="light"] .modal-actions button.primary {
  background: rgba(22,163,74,0.15);
  border-color: #16a34a;
  color: #16a34a;
}
[data-theme="light"] .amount-pos {
  color: #16a34a;
}
[data-theme="light"] .hub-center:hover {
  box-shadow: 0 0 40px rgba(22,163,74,0.15);
  border-color: rgba(22,163,74,0.3);
}
[data-theme="light"] .hub-center.expanded {
  box-shadow: 0 0 50px rgba(22,163,74,0.2);
  border-color: rgba(22,163,74,0.3);
}
[data-theme="light"] .pulse-ring {
  border-color: rgba(22,163,74,0.2);
  animation: pulseExpandLight 2s ease-out infinite;
}
[data-theme="light"] .pulse-ring.delay {
  animation-delay: 1s;
}
@keyframes pulseExpandLight {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}
[data-theme="light"] .hub-module:hover {
  border-color: #16a34a;
  box-shadow: 0 0 24px rgba(22,163,74,0.1);
}
[data-theme="light"] .detail-card h2 {
  color: #16a34a;
}
[data-theme="light"] .tab-btn.active {
  background: rgba(22,163,74,0.1);
  color: #16a34a;
}
[data-theme="light"] .hub-tab.active {
  background: rgba(22,163,74,0.1);
  color: #16a34a;
}
[data-theme="light"] .add-btn:hover {
  background: rgba(22,163,74,0.2);
}
[data-theme="light"] .action-btn-sm:hover {
  background: rgba(22,163,74,0.15);
}
</style>
