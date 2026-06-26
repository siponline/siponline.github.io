
> - Cheon-Kim-Kim-Song -> CKKS
> - CKKS方案构造基于BGV方案
> - 相比其他方案，CKKS最大的优点在于使用编码、放缩等方法将浮点数纳入了计算范围。

:::info
论文原文：[2017-Asiacrypt-Homomorphic Encryption for Arithmetic of Approximate Numbers (HEAAN)](https://link.springer.com/content/pdf/10.1007/978-3-319-70694-8_15.pdf)

Overview：![](https://notes.sjtu.edu.cn/uploads/upload_2ec6689635735bda6e3a1ae7c6027dbb.png)
:::

:::success
方案解决的三个主要问题：
1. **传统同态加密只能算"精确整数"，没法算实数/近似数**：把RLWE安全噪声当作计算误差，解密结构改为 `<c,sk> = m + e`，直接做密文近似算术。
2. **运算后有效高位会被噪声破坏，无法保留精度**：设计 **重缩放（Rescaling）** 操作，乘法后截断低位、保留高位，不破坏有效信息。
3. **多层乘法后数值会指数级变大，密文模数巨大、不实用**：用固定基数除法动态截断低位，让消息大小基本恒定，密文模数 **随深度线性增长** 而非指数增长。
:::

## 1、编码与解码核心思想

:::danger
![](https://notes.sjtu.edu.cn/uploads/upload_45d8852341ffa448dbf1e37eb28b5d47.png)

$\|m\|_{\infty}^{\text{can}} \ll q$ 表示：明文多项式的"标准嵌入无穷范数"远远小于密文模数 q
- **$\|m\|_{\infty}^{\text{can}}$** 为明文大小度量，表示多项式 $m(X)$ 映射到复数域后，所有取值里最大的那个模长
- **q** 为密文模数，代表同态加密里的"运算上限"

![](https://notes.sjtu.edu.cn/uploads/upload_9e9628413ebd16de50e17fbac9ae55bc.png)

![](https://notes.sjtu.edu.cn/uploads/upload_301f561d5011afd8fb572f17cfba579a.png)
![](https://notes.sjtu.edu.cn/uploads/upload_30d5ec37c2543a520ea86b896444fde3.png)
:::

- $\mathbb{Z}(X)/(X^N+1)$ 为以 $(X^N+1)$ 为理想的整数多项式商环。
- 系数为实数时，$N-1$ 阶多项式可以唯一确定地表示任意 $N/2$ 对共轭复数组成的向量。
- $X^N+1=0$ 的 $N$ 个根，都是 $2N$ 次本原单位根（$e^{\frac{\pi i}{N}}$），编码过程就是求解多项式系数的过程。
- 解码则直接将 $N$ 个 $2N$ 次本原单位根代入多项式。

## 2、算法细节

:::warning
同态运算会影响明文的大小，同时造成消息与噪声的增长。
为了动态管控消息和噪声的幅值，需要为每个密文 **附加消息上界与误差上界的标记**。

![](https://notes.sjtu.edu.cn/uploads/upload_cdf19c6474ed38c01b3d801e1ac98ca0.png)

$c \in R_{q_{\ell}}^{k}$ 为密文向量，$0 \le \ell \le L$ 为运算层级，$\nu\in\mathbb R$ 为 **消息幅值上界**，$B\in\mathbb R$ 为 **噪声幅值上界**。

![](https://notes.sjtu.edu.cn/uploads/upload_a580fa0d5d37682ffa180fed701b7352.png)
:::

### 参数介绍

:::info
#### 1. 核心代数结构：环 $\mathcal{R} = \mathbb{Z}[X]/(X^N+1)$
- $N$ 是 2 的幂（$M=2N$），$X^N=-1$，多项式乘法满足循环卷积。
- 环上元素是次数 $<N$ 的多项式，系数在 $\mathbb{Z}$ 中。
- 模 $q$ 环：$\mathcal{R}_q = \mathbb{Z}_q[X]/(X^N+1)$。

#### 2. 分布
- $\mathcal{HW T}(h)$：**Hamming Weight 分布**，系数中恰好有 $h$ 个 1。
- $\mathcal{R}_{q}$：**均匀分布**。
- $\mathcal{DG}(\sigma^2)$：**离散高斯分布**，均值 0，方差 $\sigma^2$，LWE/RLWE 噪声来源。
- $\mathcal{ZO}(0.5)$：**零-一分布**，系数是 0 或 1，概率各 0.5。

#### 3. 嵌入与编码（HEAAN 的灵魂）
- $\pi^{-1}$：**规范嵌入的逆**，把复数向量映射回多项式环。
- $[\cdot]_{\sigma(\mathcal{R})}$：**截断/舍入操作**。
- $\zeta_M = e^{2\pi i / M}$：$M$ 次本原单位根，用于 DFT/NTT 编码。

#### 4. 其他关键参数
- $\lambda$：安全参数（如 128-bit 安全）。
- $q_L$：初始密文模数。
- $P$：辅助模数，用于重线性化。
- $h$：秘密密钥的汉明重量。
- $\sigma$：噪声标准差。
:::

### 算法步骤

:::success
#### 1. KeyGen

![](https://notes.sjtu.edu.cn/uploads/upload_d9d52711ab33aeaf815b97720aff2bd7.png)

**功能**：根据安全参数生成同态加密所需的全部密钥材料。

1. 给定安全参数 $\lambda$，选择 $M, h, P, \sigma$
2. **生成私钥 $sk$ 和公钥 $pk$**：
   - $s \leftarrow \mathcal{HWT}(h)$：采样稀疏私钥多项式
   - $a \leftarrow \mathcal{R}_{q_L}$：均匀采样
   - $e \leftarrow \mathcal{DG}(\sigma^2)$：采样噪声
   - $sk = (1, s)$，$pk = (b, a)$，其中 $b = -a s + e \pmod{q_L}$
3. **生成评估密钥 $evk$**：
   - $a' \leftarrow \mathcal{R}_{P \cdot q_L}$
   - $e' \leftarrow \mathcal{DG}(\sigma^2)$
   - $evk = (b', a')$，其中 $b' = -a' s + e' + P s^2 \pmod{P q_L}$
   > 评估密钥是为乘法操作设计的：两个密文相乘后出现 $s^2$ 项，需用 $evk$ 变回线性 $s$ 项（重线性化）。

#### 2. Encode：编码算法

![](https://notes.sjtu.edu.cn/uploads/upload_e8162f050d6e726ccdec851c8c596db3.png)

**功能**：把复数向量 $z$ 编码成环 $\mathcal{R}$ 上的多项式。

计算：$[\Delta \cdot \pi^{-1}(z)]_{\sigma(\mathcal{R})}$
1. $\pi^{-1}(z)$：逆规范嵌入映射到多项式
2. 乘以 $\Delta$：定点数缩放
3. $[\cdot]_{\sigma(\mathcal{R})}$：截断系数

#### 3. Decode：解码算法

![](https://notes.sjtu.edu.cn/uploads/upload_59bd826208d3de54b5703463cb662c41.png)

**功能**：把解密后的多项式解码回复数向量。

计算：$z_j = \left\lfloor \Delta^{-1} \cdot m(\zeta_M^j) \right\rceil$

#### 4. Encrypt：加密算法

![](https://notes.sjtu.edu.cn/uploads/upload_ac76c31a26cbca071b73cda501dcf199.png)

**功能**：把编码后的明文多项式 $m$ 加密成 RLWE 密文。

采样 $v \leftarrow \mathcal{ZO}(0.5)$，$e_0, e_1 \leftarrow \mathcal{DG}(\sigma^2)$

$c = v \cdot pk + (m + e_0, e_1) \pmod{q_L}$

#### 5. Decrypt：解密算法

![](https://notes.sjtu.edu.cn/uploads/upload_74e4d5ff086cec12c56cce15430a8e2a.png)

**功能**：把密文解密回明文多项式。

$b + a \cdot s \pmod{q_\ell}$，得到 $m + e$，噪声 $e$ 被当作近似计算误差。

#### 6. Add：密文加法

![](https://notes.sjtu.edu.cn/uploads/upload_f36f34deee382358d38abd5226f29a16.png)

**功能**：两个密文对应相加，实现同态加法。

$c_{\text{add}} = c_1 + c_2 \pmod{q_e}$

解密后是 $m_1 + m_2 + e_1 + e_2$，噪声线性增长。

#### 7. Multiply：密文乘法（带重线性化）

![](https://notes.sjtu.edu.cn/uploads/upload_75e439df094d66ea04c0099b926a722c.png)

**功能**：两个密文相乘，同时用评估密钥消除 $s^2$ 项。

计算中间乘积 $(d_0, d_1, d_2)$，然后用 $evk$ 做重线性化：

$c_{\text{mult}} = (d_0, d_1) + \left\lfloor P^{-1} \cdot d_2 \cdot evk \right\rceil \pmod{q_e}$

#### 8. Rescale：重缩放

![](https://notes.sjtu.edu.cn/uploads/upload_83e6b7abddab83f7c6b17b93346254b9.png)

**功能**：降低密文模数，同时缩小明文的缩放因子。

$c' = \left\lfloor \frac{q_{e'}}{q_e} c \right\rceil \pmod{q_{e'}}$

每层模数线性下降，噪声增长被控制。
:::

## 3、论文拾遗

- **Approximate Arithmetic**：**近似算术运算**，适配浮点、实数类非精确数值计算。
- 已知 $m_1$ 和 $m_2$ 的密文，该方案能够以 **预设精度**，安全计算出 $m_1+m_2$ 与 $m_1m_2$ 近似值的密文。
- 核心思想：将 **环格容错学习（RLWE）问题** 中引入的安全噪声，视为近似计算过程中产生误差的一部分。
- 该方案最核心的特性是 **明文舍入操作**。舍入操作会剔除消息的部分最低有效位（LSB），在 **数值大小** 与 **精度损失** 之间进行权衡。
- 同态加密系统中的 **批处理技术** 在 **单个密文中加密多条消息**，以 **SIMD** 方式实现并行处理。
- **Leveled Homomorphic Encryption (LHE)**：**层级同态加密**，支持有限乘法运算深度、无需自举的同态加密方案。
- 层级同态加密靠层级限制同态计算深度，自举通过隐式同态解密刷新密文噪声与层级，把受限的层级同态扩展成全同态。

## 4. 密钥管理速查表

| 密钥类型     | 英文名称            | 用途                               | 可否公开     | 备注                                       |
| ------------ | ------------------- | ---------------------------------- | ------------ | ------------------------------------------ |
| 公钥         | Public Key          | 加密数据                           | ✅ 可公开分发 | 不能用于解密                               |
| 私钥         | Secret Key          | 解密数据                           | ❌ 必须保密   | 一旦泄露，所有密文安全性失效               |
| 计算密钥     | Evaluation Key      | 支持密文计算（加法、乘法、变换等） | ✅ 可公开     | 不具备解密能力                             |
| 旋转密钥     | Rotation Key        | 密文向量 slot rotation             | ✅ 可公开     | 支持矩阵乘法、卷积、Attention 等 SIMD 运算 |
| 重线性化密钥 | Relinearization Key | 密文乘法后压缩密文维度             | ✅ 可公开     | 防止密文尺寸持续膨胀                       |
| 自举密钥     | Bootstrap Key       | 执行 Bootstrapping（密文刷新）     | ✅ 可公开     | 体积最大、计算最复杂、资源消耗最高         |

