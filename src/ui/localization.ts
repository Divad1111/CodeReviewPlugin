import * as vscode from 'vscode';

export type Language = 'en' | 'zh';

export interface LocalizedStrings {
    settingsTitle: string;
    svnCredentials: string;
    username: string;
    password: string;
    aiEngine: string;
    currentModel: string;
    endpoint: string;
    modelName: string;
    apiKey: string;
    addNewModel: string;
    editSelected: string;
    deleteSelected: string;
    codingStandards: string;
    codingStandardsDesc: string;
    otherSettings: string;
    debugMode: string;
    language: string;
    saveAll: string;
    addModelTitle: string;
    editModelTitle: string;
    editDefaultModelTitle: string;
    providerName: string;
    confirm: string;
    cancel: string;
    modelNotFound: string;
    apiKeyMissing: string;
    aiAuditStart: string;
    aiAuditComplete: string;
    analyzingFile: string;
    skippingAudited: string;
    forcingReAudit: string;
    aiSuggestedComments: string;
    alreadyAuditedMsg: string;
    errorPrefix: string;
    successSaved: string;
    modelAdded: string;
    modelUpdated: string;
    modelDeleted: string;
    deleteConfirm: string;
    unsavedChanges: string;
    discard: string;
    save: string;
    exportSettings: string;
    importSettings: string;
    importSuccess: string;
    importError: string;
    reviewResult: string;
    fileFiltering: string;
    fileFilteringDesc: string;
    deleteFile: string;
}

const en: LocalizedStrings = {
    settingsTitle: "SVN Audit Settings",
    svnCredentials: "SVN Credentials (Optional)",
    username: "Username",
    password: "Password",
    aiEngine: "AI Engine",
    currentModel: "Select Current Model",
    endpoint: "Endpoint",
    modelName: "Model Name",
    apiKey: "API Key",
    addNewModel: "Add New Model",
    editSelected: "Edit Selected",
    deleteSelected: "Delete Selected",
    codingStandards: "Coding Standards",
    codingStandardsDesc: "Definition (Guidelines for naming, comments, logic checks, etc.)",
    otherSettings: "Other Settings",
    debugMode: "Enable AI Debug Mode (Log requests/responses to output channel)",
    language: "Language (界面语言)",
    saveAll: "Save All Settings",
    addModelTitle: "Add AI Model",
    editModelTitle: "Edit AI Model",
    editDefaultModelTitle: "Edit Default Model (API Key & Model Name only)",
    providerName: "Provider Name (e.g., OpenAI)",
    confirm: "Confirm",
    cancel: "Cancel",
    modelNotFound: "AI Model not found.",
    apiKeyMissing: "AI API Key is missing. Please set it in settings.",
    aiAuditStart: "Starting AI Audit",
    aiAuditComplete: "AI Audit Complete.",
    analyzingFile: "Analyzing file",
    skippingAudited: "Skipping already audited files.",
    forcingReAudit: "Forcing re-analysis of all files.",
    aiSuggestedComments: "AI suggested comments.",
    alreadyAuditedMsg: "This file has already been audited. Use 'Force Audit' to re-analyze.",
    errorPrefix: "Error",
    successSaved: "Settings saved successfully.",
    modelAdded: "Model added.",
    modelUpdated: "Model updated.",
    modelDeleted: "Model deleted.",
    deleteConfirm: "Are you sure you want to delete this model?",
    unsavedChanges: "You have unsaved changes in Settings. Do you want to save them?",
    discard: "Discard",
    save: "Save",
    exportSettings: "Export Config",
    importSettings: "Import Config",
    importSuccess: "Settings imported successfully.",
    importError: "Failed to import settings. Invalid file format.",
    reviewResult: "Review Result",
    fileFiltering: "File Filtering",
    fileFilteringDesc: "Exclude files by name (e.g. *.meta, *.prefab)",
    deleteFile: "Remove file from review",
};

const zh: LocalizedStrings = {
    settingsTitle: "SVN 审计设置",
    svnCredentials: "SVN 凭据 (可选)",
    username: "用户名",
    password: "密码",
    aiEngine: "AI 引擎",
    currentModel: "当前 AI 模型",
    endpoint: "接口地址 (Endpoint)",
    modelName: "模型名称 (Model Name)",
    apiKey: "API Key",
    addNewModel: "添加新模型",
    editSelected: "编辑选中模型",
    deleteSelected: "删除选中模型",
    codingStandards: "编码规范",
    codingStandardsDesc: "规范定义 (命名、注释、逻辑检查等指南)",
    otherSettings: "其他设置",
    debugMode: "开启 AI 调试模式 (在输出窗口打印请求和返回内容)",
    language: "Language (界面语言)",
    saveAll: "保存所有设置",
    addModelTitle: "添加 AI 模型",
    editModelTitle: "编辑 AI 模型",
    editDefaultModelTitle: "编辑默认模型 (仅限 API Key 和模型名)",
    providerName: "供应商名称 (如: OpenAI)",
    confirm: "确认",
    cancel: "取消",
    modelNotFound: "未找到 AI 模型配置。",
    apiKeyMissing: "AI API Key 缺失，请在设置中配置。",
    aiAuditStart: "开始 AI 审计",
    aiAuditComplete: "AI 审计完成。",
    analyzingFile: "正在分析文件",
    skippingAudited: "跳过已审计的文件。",
    forcingReAudit: "强制重新分析所有文件。",
    aiSuggestedComments: "AI 建议了条评论。",
    alreadyAuditedMsg: "此文件已审计。若要重新分析，请使用“强制 AI 审计”。",
    errorPrefix: "错误",
    successSaved: "设置保存成功。",
    modelAdded: "模型已添加。",
    modelUpdated: "模型已更新。",
    modelDeleted: "模型已删除。",
    deleteConfirm: "确定要删除此模型吗？",
    unsavedChanges: "设置中有未保存的修改。是否保存？",
    discard: "不保存",
    save: "保存",
    exportSettings: "导出配置",
    importSettings: "导入配置",
    importSuccess: "配置导入成功。",
    importError: "配置导入失败。请检查文件格式是否正确。",
    reviewResult: "审核结果",
    fileFiltering: "文件过滤",
    fileFilteringDesc: "通过文件名模糊匹配过滤（如：*.meta, *.prefab）",
    deleteFile: "从本次审核中移除文件",
};

export function getLocalization(lang?: string): LocalizedStrings {
    if (!lang) {
        const vscodeLang = vscode.env.language.toLowerCase();
        lang = (vscodeLang.startsWith('zh')) ? 'zh' : 'en';
    }
    return lang === 'zh' ? zh : en;
}
