/* ========== 通义大模型生态赋能中心活动资讯 - 公共JS ========== */

// 数据管理模块
const EventManager = {
    STORAGE_KEY: 'tongyi_events',

    // 获取所有活动
    getAll() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    // 根据ID获取活动
    getById(id) {
        const events = this.getAll();
        return events.find(e => e.id === id);
    },

    // 安全写入localStorage（捕获容量超限异常）
    _safeSave(events) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
            return { success: true };
        } catch (err) {
            // 容量超限或其他异常
            const isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22 || err.code === 1014);
            return {
                success: false,
                message: isQuota
                    ? '存储空间已满！localStorage约5MB限制。请减少图片数量或压缩图片大小后重试。'
                    : '保存失败：' + (err && err.message ? err.message : '未知错误')
            };
        }
    },

    // 添加活动
    add(event) {
        const events = this.getAll();
        event.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        event.createTime = new Date().toISOString();
        events.unshift(event);
        const result = this._safeSave(events);
        if (!result.success) {
            return { success: false, message: result.message };
        }
        return { success: true, data: event };
    },

    // 更新活动
    update(id, updatedData) {
        const events = this.getAll();
        const index = events.findIndex(e => e.id === id);
        if (index === -1) {
            return { success: false, message: '未找到对应活动' };
        }
        const original = events[index];
        events[index] = { ...original, ...updatedData, updateTime: new Date().toISOString() };
        const result = this._safeSave(events);
        if (!result.success) {
            // 回滚内存中的变更（不影响持久化数据）
            events[index] = original;
            return { success: false, message: result.message };
        }
        return { success: true, data: events[index] };
    },

    // 删除活动
    delete(id) {
        let events = this.getAll();
        events = events.filter(e => e.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
    },

    // 初始化默认数据：按版本号合并内置活动，保证所有访问者都能看到最新内置活动
    initSampleData() {
        const defaults = (typeof DEFAULT_EVENTS !== 'undefined') ? DEFAULT_EVENTS : [];
        const version = (typeof DEFAULT_EVENTS_VERSION !== 'undefined') ? DEFAULT_EVENTS_VERSION : 0;
        const verKey = this.STORAGE_KEY + '_defaults_ver';
        if (parseInt(localStorage.getItem(verKey) || '0', 10) >= version) return;
        const events = this.getAll();
        const missing = defaults.filter(d => !events.some(e => e.id === d.id));
        if (missing.length === 0) {
            localStorage.setItem(verKey, String(version));
            return;
        }
        const result = this._safeSave(missing.concat(events));
        if (result.success) {
            localStorage.setItem(verKey, String(version));
        }
    }
};

// 工具函数
const Utils = {
    // 格式化日期
    formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // 获取URL参数
    getUrlParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    },

    // 显示提示消息
    showToast(message, type = 'success') {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `toast ${type}`;
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    // 图片转Base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // 压缩图片（限制最长边并降低质量，避免localStorage超限）
    compressImage(file, options = {}) {
        const maxSize = options.maxSize || 1280; // 最长边
        const quality = options.quality || 0.7;  // JPEG压缩质量
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                return this.fileToBase64(file).then(resolve).catch(reject);
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxSize || height > maxSize) {
                        if (width > height) {
                            height = Math.round(height * (maxSize / width));
                            width = maxSize;
                        } else {
                            width = Math.round(width * (maxSize / height));
                            height = maxSize;
                        }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    // 透明PNG保留为PNG，否则转JPEG
                    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                    resolve(canvas.toDataURL(mime, quality));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // 获取活动状态文本
    getStatusText(status) {
        const map = {
            'active': '报名中',
            'ended': '已结束',
            'upcoming': '即将开始'
        };
        return map[status] || status;
    },

    // 获取分类图标
    getCategoryIcon(category) {
        const icons = {
            '技术沙龙': '💡',
            '行业峰会': '🏛️',
            '培训课程': '📚',
            '工作坊': '🛠️',
            '线上直播': '📺',
            '其他': '📌'
        };
        return icons[category] || '📌';
    }
};

// 张江AI创新小镇活动管理模块
const ZhangjiangManager = {
    STORAGE_KEY: 'zhangjiang_events',

    getAll() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    getById(id) {
        return this.getAll().find(e => e.id === id);
    },

    _safeSave(events) {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
            return { success: true };
        } catch (err) {
            const isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22);
            return {
                success: false,
                message: isQuota
                    ? '存储空间已满！请减少图片数量或压缩图片。'
                    : '保存失败：' + (err && err.message ? err.message : '未知错误')
            };
        }
    },

    add(event) {
        const events = this.getAll();
        event.id = 'zj_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        event.createTime = new Date().toISOString();
        events.unshift(event);
        const result = this._safeSave(events);
        if (!result.success) return { success: false, message: result.message };
        return { success: true, data: event };
    },

    update(id, updatedData) {
        const events = this.getAll();
        const index = events.findIndex(e => e.id === id);
        if (index === -1) return { success: false, message: '未找到对应活动' };
        const original = events[index];
        events[index] = { ...original, ...updatedData, updateTime: new Date().toISOString() };
        const result = this._safeSave(events);
        if (!result.success) { events[index] = original; return { success: false, message: result.message }; }
        return { success: true, data: events[index] };
    },

    delete(id) {
        let events = this.getAll();
        events = events.filter(e => e.id !== id);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(events));
    },

    initSampleData() {
        if (this.getAll().length === 0) {
            const sampleEvents = [
                {
                    id: 'zj_sample1',
                    title: '张江AI创新小镇开发者开放日',
                    date: '2026-06-22',
                    time: '14:00',
                    location: '张江AI创新小镇·路演大厅',
                    category: '技术沙龙',
                    status: 'active',
                    organizer: '张江AI创新小镇',
                    description: '面向开发者的开放日活动，体验最新AI技术应用，包括大模型交互演示、机器人互动、智能硬件展示等。\n\n活动安排：\n14:00-14:30 签到入场\n14:30-15:30 AI技术分享与Demo展示\n15:30-16:30 动手实验室（Hands-on Lab）\n16:30-17:00 自由交流与项目对接',
                    cover: '',
                    images: [],
                    createTime: '2026-06-10T08:00:00.000Z'
                },
                {
                    id: 'zj_sample2',
                    title: '张江人工智能产业峰会 2026',
                    date: '2026-07-10',
                    time: '09:00',
                    location: '张江科学城·国际会议中心',
                    category: '行业峰会',
                    status: 'active',
                    organizer: '张江管委会',
                    description: '汇聚全球AI产业领袖，探讨人工智能在医疗、金融、制造等领域的落地实践，发布张江AI产业政策白皮书。',
                    cover: '',
                    images: [],
                    createTime: '2026-06-12T08:00:00.000Z'
                },
                {
                    id: 'zj_sample3',
                    title: 'AI创业训练营——张江专场',
                    date: '2026-06-28',
                    time: '10:00',
                    location: '张江AI创新小镇·孵化器3楼',
                    category: '培训课程',
                    status: 'active',
                    organizer: '张江AI创新小镇',
                    description: '为期两天的AI创业训练营，涵盖商业模式设计、技术选型、融资策略等核心课程，优秀项目可获张江孵化器入驻资格。',
                    cover: '',
                    images: [],
                    createTime: '2026-06-08T08:00:00.000Z'
                },
                {
                    id: 'zj_sample4',
                    title: '张江AI创客马拉松',
                    date: '2026-07-20',
                    time: '09:00',
                    location: '张江AI创新小镇·创客空间',
                    category: '工作坊',
                    status: 'active',
                    organizer: '张江AI创新小镇',
                    description: '48小时AI主题黑客马拉松，围绕大模型应用、智能制造、智慧医疗等赛道，组队竞技，丰厚奖金等你来拿！',
                    cover: '',
                    images: [],
                    createTime: '2026-06-05T08:00:00.000Z'
                },
                {
                    id: 'zj_sample5',
                    title: '大模型应用实战直播课',
                    date: '2026-06-18',
                    time: '19:30',
                    location: '线上直播',
                    category: '线上直播',
                    status: 'active',
                    organizer: '张江AI创新小镇',
                    description: '通义千问API接入实战，从Prompt工程到Agent开发，手把手教你构建AI应用。',
                    cover: '',
                    images: [],
                    createTime: '2026-06-14T08:00:00.000Z'
                },
                {
                    id: 'zj_sample6',
                    title: '张江AI小镇月度技术交流沙龙',
                    date: '2026-05-25',
                    time: '15:00',
                    location: '张江AI创新小镇·咖啡书吧',
                    category: '技术沙龙',
                    status: 'ended',
                    organizer: '张江AI创新小镇',
                    description: '每月固定的技术交流活动，本月主题为“多模态大模型的应用前景”，邀请多位行业专家分享最新研究成果。',
                    cover: '',
                    images: [],
                    createTime: '2026-05-10T08:00:00.000Z'
                }
            ];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sampleEvents));
        }
    }
};

// AI资讯数据（2026年8月最新）
const aiNewsData = [
    { id: 'news1', tag: '千问', tagClass: 'qwen', title: '阿里正式发布 Qwen3.8-Max：2.4 万亿参数旗舰模型，自主编程 16 天破纪录', time: '10分钟前', source: '阿里云官方', sourceUrl: 'https://qwen.ai', summary: '8月3日，阿里正式发布 Qwen3.8-Max，总参数 2.4 万亿（MoE 架构激活 950 亿），支持 100 万 Token 上下文，PaperBench 全球第一，Vision Arena 全球第二，模型权重将开源。', content: '8月3日，阿里云通义千问团队正式发布新一代旗舰大模型 Qwen3.8-Max。该模型总参数量达 2.4 万亿，采用稀疏 MoE 架构，单次推理激活约 950 亿参数，支持 100 万 Token 超长上下文。\n\nQwen3.8-Max 在多项权威基准中表现卓越：PaperBench 学术编程 93.0 分（全球第一），Vision Arena 视觉理解全球第二。最引人注目的是，该模型从一个空文件夹开始，在无人工介入情况下连续自主编程 16 天，自主搭建出真实可用的自进化智能体框架。\n\nAPI 定价国内每百万 Token 输入 12 元、输出 36 元，仅为海外 Opus 5 的 40%。阿里同时宣布将开源 Qwen3.8-Max 权重及 Qwen3.8-27B 小尺寸模型。\n\n发布当日阿里巴巴港股收涨 7.01%，市值暴涨约 1300 亿港元。' },
    { id: 'news2', tag: '模型', tagClass: 'model', title: 'DeepSeek V4 Flash 正式版登顶全球调用量榜首，单日处理 8 万亿 Token', time: '25分钟前', source: 'DeepSeek官方', sourceUrl: 'https://www.deepseek.com', summary: 'DeepSeek V4 Flash 正式版 API 上线后迅速登顶 OpenRouter 全球模型调用量榜首，单日处理 Token 总量达 8 万亿，宣布近期将上调 API 定价。', content: '7月31日，DeepSeek 发布 V4 Flash 正式版 API（DeepSeek-V4-Flash-0731），采用 MoE 架构，总参数 284B（激活 13B），支持 100 万 Token 上下文，最大输出 384K。\n\n上线仅数日，DeepSeek V4 Flash 便登顶 OpenRouter 平台全球单模型调用量第一名。据 OpenCode 披露，8月1日当天该平台单日处理 Token 总量达 8 万亿，其中 5 万亿来自免费试用额度。\n\n在 Artificial Analysis 测评榜单中，DeepSeek V4 Flash 智能指数仅比 GPT-5.6 Luna 低 1 分。原生支持 Responses API 并针对 Codex 优化，Agent 能力大幅增强。\n\n8月6日，DeepSeek 发布公告称计划近期整体上调 API 定价，"预计涨幅较大"。' },
    { id: 'news3', tag: 'AI', tagClass: 'ai', title: 'MiniMax H3 与字节 Seedance 2.5 同日发布，AI 视频进入"三国杀"新赛程', time: '50分钟前', source: '36氪', sourceUrl: 'https://36kr.com', summary: '7月31日，MiniMax H3 和字节 Seedance 2.5 同日发布。H3 主打全模态开源低价，Seedance 2.5 单次生成 30 秒 4K 视频走闭源工业化路线。', content: '7月31日，AI 视频生成赛道迎来"撞车日"：MiniMax H3 和字节跳动 Seedance 2.5 几乎同时上线。\n\nMiniMax H3 是通用全模态生成模型，支持文本+图像+视频+音频统一上下文，最高 15 秒 2K 分辨率原生双声道音视频输出，定价 0.8 元/秒（约为同类旗舰的三分之一），并宣布开源模型权重。\n\n字节 Seedance 2.5 延续闭源工业化路线，单次生成时长从 15 秒翻倍至 30 秒，原生 4K 支持，最多 50 个全模态参考素材，已占据国内 AI 视频超八成市场份额。\n\n分析指出，AI 视频正成为继 AI Coding 之后第二个跑通大规模商业化的 AI 赛道。' },
    { id: 'news4', tag: '千问', tagClass: 'qwen', title: '千问办公（QwenWork）启动公测，Qwen3.8-Max 旗舰大脑驱动企业级 Agent', time: '1小时前', source: '阿里云官方', sourceUrl: 'https://qwen.ai', summary: '与 Qwen3.8-Max 同步，阿里旗下企业级 Agent 产品"千问办公"正式开启公测，将旗舰大模型能力直接注入办公场景。', content: '8月3日，阿里旗下企业级 Agent 产品"千问办公"（QwenWork）正式开启公测，Qwen3.8-Max 的 API 已同步上线千问 AI 平台。\n\n千问办公将 Qwen3.8-Max 作为核心"旗舰大脑"，依托真实业务环境与算力协同强化学习优化，可胜任数百种高频专业任务：能将法务团队一周的文档审阅量压缩至一小时完成，也可凭自然语言指令规划复杂动态工作流，甚至交付可盈利的端到端量化交易策略。\n\n这意味着阿里已形成"通义千问大模型+阿里云算力+平头哥自研芯片"的全栈 AI 布局，模型升级、算力调度、产品定价主动权均掌握在自己手中。' },
    { id: 'news5', tag: 'AI', tagClass: 'ai', title: 'OpenAI GPT-5.6 Luna API 降价 80%，大模型价格战持续升级', time: '1.5小时前', source: 'OpenAI Blog', sourceUrl: 'https://openai.com/blog', summary: 'OpenAI 宣布 GPT-5.6 Luna API 输入价格降至 $0.2/百万 Token，降幅达 80%，但仍比 DeepSeek V4 Flash 贵约 60%。', content: 'OpenAI 近日官宣 GPT-5.6 Luna 的 API 降价 80%，输入价格降至 $0.2/百万 Token。这是继此前多轮降价后的又一次大幅调整。\n\n然而，即便降价后 GPT-5.6 Luna 的价格仍比 DeepSeek V4 Flash 贵约 60%。有开发者在评论区贴出 DeepSeek 价格对比图，引发热议，不少人认为中国大模型的价格竞争力正让 OpenAI 感到压力。\n\n与此同时，国产大模型也在密集调价：DeepSeek 宣布将上调 API 定价，智谱 GLM 订阅价格上涨 2-3 倍，行业价格格局正在快速重塑。' },
    { id: 'news6', tag: 'AI', tagClass: 'ai', title: '发改委：上半年 AI 相关行业增速超 30%，国产大模型下载量突破 100 亿次', time: '2小时前', source: '国家发改委', sourceUrl: 'https://www.ndrc.gov.cn', summary: '国家发改委发布上半年 AI 产业数据：AI 相关行业保持 30% 以上高增长，首个全国产 10 万卡 AI 超集群落地，国产大模型全球下载量突破 100 亿次。', content: '7月31日，国家发展改革委召开新闻发布会，介绍上半年人工智能产业发展情况。\n\n核心数据包括：AI 相关行业保持 30% 以上高增长；算力底座持续夯实，首个全国产 10 万卡 AI 超集群落地；6 月底全国智能算力规模为去年同期的 2.8 倍；国产大模型全球下载量突破 100 亿次。\n\n工信部数据显示，2025 年我国人工智能核心产业规模已突破 1.2 万亿元，专业化 AI 企业超 6200 家。进入 2026 年，国内大模型发展重心显著转向智能体赛道。\n\n发改委表示将加快人工智能法立法进程，统筹高质量发展和高水平安全。' },
    { id: 'news7', tag: '模型', tagClass: 'model', title: '华为开源盘古 5050 亿参数大模型，国产超大规模模型生态再添重磅成员', time: '3小时前', source: '华为官方', sourceUrl: 'https://www.huawei.com', summary: '华为正式开源盘古 5050 亿参数大模型，成为国产超大规模开源模型的重要新成员。', content: '华为近日正式开源盘古 5050 亿参数大模型，这是国产超大规模开源模型生态中的又一重磅成员。\n\n盘古模型的开源标志着华为在 AI 领域的开放战略迈出重要一步。此前华为已在昇腾算力平台和多模态 AI 领域持续投入，盘古大模型的开源将为国内开发者提供更多高性能模型选择。\n\n与此同时，国内开源大模型生态正在加速壮大：通义千问开源社区开发者突破 50 万，DeepSeek 系列模型在全球开发者中广泛使用，MiniMax H3 成为首个商用级开源多模态视频模型。' },
    { id: 'news8', tag: '千问', tagClass: 'qwen', title: 'Qwen3.8-Max 参加人类竞赛 24 小时击败 458 支参赛队伍', time: '3.5小时前', source: '阿里云天池', sourceUrl: 'https://tianchi.aliyun.com', summary: 'Qwen3.8-Max 在 WWW 2025 多模态对话意图识别挑战赛中，24 小时内自行搭建系统并击败 458 支人类参赛队伍。', content: '阿里云天池平台上的 WWW 2025 多模态对话意图识别挑战赛迎来了一位特殊"选手"——Qwen3.8-Max。\n\n模型需要同时处理电商客服对话中的文字和商品截图。它在 24 小时内自行搭建文本模型、视觉模型和加权投票系统，并根据每次提交的排名反馈继续调整方案，最终在 526 支人类队伍中击败了 458 支。\n\n另一项标志性测试中，Qwen3.8-Max 连续自主工作约 125 小时，成功复现了一篇 AI 推理相关的科研论文，并进行了四轮自我进化探索，在 AIME24 基准测试中得分再提升 2.7 分。\n\n这被视为国产大模型从"补全代码"迈向"交付项目"的重要标志。' },
    { id: 'news9', tag: '应用', tagClass: 'app', title: 'AI 视频市场份额出炉：字节 Seedance 占八成，可灵 14%，万相 4%', time: '4小时前', source: 'AI普瑞斯', sourceUrl: 'https://www.aiprice.com', summary: '据最新统计，按日消耗占比计算，字节 Seedance 已占据超八成 AI 视频市场份额，快手可灵约占 14%，阿里万相 2.7 约 4%。', content: 'AI 视频生成赛道的市场格局正在快速成型。据 AI 普瑞斯按日消耗占比统计，字节跳动 Seedance 已占据超八成市场份额，快手可灵约占 14%，阿里通义万相 2.7 约 4%。\n\n快手可灵 AI 近期完成近 30 亿美元首轮独立融资，投后估值达 180 亿美元。字节 Seedance 2.5 将单次生成时长拉至 30 秒，MiniMax H3 以开源+低价策略入局。\n\n行业分析指出，AI 视频正在成为继 AI Coding 之后第二个跑通大规模商业化的 AI 赛道，2026 下半年将迎来"降本+开源"的双重革命。' },
    { id: 'news10', tag: 'AI', tagClass: 'ai', title: 'DeepSeek 宣布 API 将大幅涨价，国产模型价格战或迎拐点', time: '4.5小时前', source: 'DeepSeek官方', sourceUrl: 'https://www.deepseek.com', summary: 'DeepSeek 发布公告称计划近期整体上调 API 服务定价，"预计涨幅较大"，此前以极致性价比著称的定价策略或将转变。', content: '8月6日，DeepSeek 发布公告称"计划近期整体上调 DeepSeek API 服务的定价"，特别提醒用户"预计涨幅较大，请合理安排您的使用"。\n\n此前 DeepSeek V4 Flash 以极低价格迅速占领市场：输入命中缓存仅 ¥0.2/百万 Token，输出 ¥1.1/百万 Token，加上 98% 缓存命中折扣实际成本更低。在 OpenRouter 平台登顶全球调用量榜首。\n\n分析认为，DeepSeek 涨价反映了大模型行业正在从"烧钱抢市场"转向"可持续盈利"的新阶段。与此同时，智谱 GLM 订阅价格也已上涨 2-3 倍，行业整体价格格局正在重塑。' },
    { id: 'news11', tag: '千问', tagClass: 'qwen', title: 'Qwen3.8-Max 综合排名全球第四，仅次于 Claude 系列和 Kimi K3', time: '5小时前', source: '国泰海通研报', sourceUrl: 'https://www.gtja.com', summary: '据国泰海通研报，Qwen3.8-Max 综合排名全球第四，API 定价仅为 Opus 5 的 40%，预计下周开源权重。', content: '根据国泰海通发布的阿里巴巴研报，Qwen3.8-Max 综合排名全球第四，仅次于 Claude 系列和 Kimi K3。\n\nAPI 定价方面，国内每百万 Token 输入 12 元、输出 36 元，海外定价为 Opus 5 的 40% 和 24%，实现"相近智能更高性价比"。\n\n研报指出，阿里已形成"通义千问大模型+阿里云算力+平头哥自研芯片"的全栈 AI 布局，是目前实现这一布局的少数头部厂商之一。Forrester 副总裁戴鲲评价称，Qwen3.8-Max 的发布标志着阿里正在缩小与闭源领先者的差距，更大的故事是开源权重模型的快速成熟。' },
    { id: 'news12', tag: '模型', tagClass: 'model', title: '全球 AI 模型调用量排行：DeepSeek V4 Flash 第一，小米 MiMo V2.5 第二', time: '5.5小时前', source: 'OpenRouter', sourceUrl: 'https://openrouter.ai', summary: 'OpenRouter 最新周度数据显示，DeepSeek V4 Flash 登顶全球调用量榜首，前五还包括小米 MiMo V2.5、腾讯 Hy3、DeepSeek V4 Pro 和智谱 GLM 5.2。', content: 'OpenRouter 发布最新一周全球模型调用量数据，国产模型表现亮眼：\n\n1. DeepSeek V4 Flash（登顶）\n2. 小米 MiMo V2.5\n3. 腾讯 Hy3\n4. DeepSeek V4 Pro\n5. 智谱 GLM 5.2\n\n值得注意的是，前五名全部为中国厂商模型，反映出国产大模型在全球开发者中的影响力正在快速提升。小米 MiMo V2.5 和腾讯 Hy3 的上榜尤其引人注目，显示 AI 大模型竞争已从阿里、百度扩展到更多科技巨头。\n\nGPT-5.6 Luna 虽在智能指数上领先，但调用量排名未进前五。' },
    { id: 'news13', tag: 'AI', tagClass: 'ai', title: '四大科技巨头 AI 资本支出达 1.1 万亿美元，算力军备竞赛白热化', time: '6小时前', source: '路透社', sourceUrl: 'https://www.reuters.com', summary: '微软、谷歌、Meta、亚马逊四大科技巨头 AI 相关资本支出合计达 1.1 万亿美元，英伟达签 500 亿美元数据中心租约。', content: '据路透社报道，微软、谷歌、Meta 和亚马逊四大科技巨头 2026 年 AI 相关资本支出合计已达 1.1 万亿美元，算力基础设施军备竞赛进入白热化阶段。\n\n英伟达近日签下 500 亿美元得州数据中心租约，进一步巩固其在 AI 算力领域的主导地位。中际旭创完成港股上市实现"A+H"布局，萤石网络中报毛利率创历史新高。\n\n国内市场方面，首个全国产 10 万卡 AI 超集群落地，6 月底全国智能算力规模为去年同期的 2.8 倍，国产替代进程加速推进。' },
    { id: 'news14', tag: '千问', tagClass: 'qwen', title: '通义千问 Qwen-Audio-3.0-Realtime 发布，语音模型进入实时交互新时代', time: '7小时前', source: '阿里云官方', sourceUrl: 'https://qwen.ai', summary: '阿里云发布通义千问语音识别新版 Qwen-Audio-3.0-Realtime，支持低延迟实时语音交互能力。', content: '阿里云近日发布通义千问语音识别新版 Qwen-Audio-3.0-Realtime，这是 7 月全球 AI 语音模型密集发布的一部分（同期还有 OpenAI 的 GPT-Live、xAI 的 Grok Voice Think Fast 2.0 等）。\n\nQwen-Audio-3.0-Realtime 主打低延迟实时语音交互，结合此前发布的 Qwen3.5-LiveTranslate 音色克隆同传模型，通义千问在语音领域的布局日趋完善。\n\n配合 Qwen3.8-Max 的原生多模态能力，千问已形成文本+图像+视频+语音的全模态覆盖体系。' },
    { id: 'news15', tag: '应用', tagClass: 'app', title: '特斯拉车机引入豆包大模型，AI 上车加速渗透消费电子', time: '7.5小时前', source: '钛媒体', sourceUrl: 'https://www.tmtpost.com', summary: '特斯拉中国车机系统确认引入字节跳动豆包大模型，AI 大模型在智能汽车和消费电子领域的渗透加速。', content: '特斯拉中国车机系统近日确认引入字节跳动豆包大模型，为车主提供更智能的语音交互和内容生成能力。这是 AI 大模型"上车"的又一标志性事件。\n\n与此同时，AI 大模型正在加速渗透消费电子各个领域：苹果获批在中国推出 Apple Intelligence，MCP 协议升级为无状态架构以支持更广泛的设备互联，NovelAI 内测第五代图像模型。\n\n行业分析认为，2026 年下半年将是 AI 大模型从"云端"走向"终端"的关键期，智能汽车、手机、IoT 设备将成为主要落地场景。' },
    { id: 'news16', tag: 'AI', tagClass: 'ai', title: 'GitHub Copilot 下架 Gemini 模型，AI 编程工具生态格局生变', time: '8小时前', source: 'GitHub Blog', sourceUrl: 'https://github.blog', summary: 'GitHub Copilot 宣布下架 Google Gemini 模型选项，AI 编程工具市场竞争加剧，通义千问 Qwen-Coder 市场份额快速增长。', content: 'GitHub 近日宣布在 Copilot 中下架 Google Gemini 模型选项，此举引发开发者社区广泛讨论。\n\n在 AI 编程工具市场，通义千问 Qwen-Coder 凭借出色的代码生成能力和开源策略，市场份额快速增长。据 Stack Overflow 和 JetBrains 联合调查，AI 编程助手在全球开发者中的使用渗透率已超过 60%，Qwen-Coder 市场份额已达 15%。\n\n与此同时，微软宣布将在年内推出 Copilot 超级应用，整合旗下多款 AI 工具和服务，AI 编程赛道的竞争正在从单一模型走向生态体系。' },
];

// 根据ID获取资讯
function getNewsById(id) {
    return aiNewsData.find(n => n.id === id);
}

// 页面初始化（立即执行，保证首屏渲染前默认数据已就绪）
EventManager.initSampleData();
ZhangjiangManager.initSampleData();
