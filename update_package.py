import json

path = './client/package.json'
with open(path, 'r', encoding='utf-8') as f:
    pkg = json.load(f)

newCommands = [
    { "command": "svnAudit.login", "title": "Login / Start", "icon": "$(sign-in)" },
    { "command": "svnAudit.login.zh", "title": "登录 / 启动", "icon": "$(sign-in)" },
    { "command": "svnAudit.logout", "title": "Logout", "icon": "$(sign-out)" },
    { "command": "svnAudit.logout.zh", "title": "退出登录", "icon": "$(sign-out)" },
    { "command": "svnAudit.userManagement", "title": "User Management", "icon": "$(organization)" },
    { "command": "svnAudit.userManagement.zh", "title": "用户管理", "icon": "$(organization)" }
]

existingCmdIds = set(c["command"] for c in pkg["contributes"]["commands"])
for cmd in newCommands:
    if cmd["command"] not in existingCmdIds:
        pkg["contributes"]["commands"].append(cmd)

pkg["contributes"]["menus"]["view/title"] = [
  { "command": 'svnAudit.login', "when": "view == svnAuditSidebar && !svnAudit.isLoggedIn && !svnAudit.isZh", "group": "navigation@0" },
  { "command": 'svnAudit.login.zh', "when": "view == svnAuditSidebar && !svnAudit.isLoggedIn && svnAudit.isZh", "group": "navigation@0" },
  
  { "command": 'svnAudit.newSession', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && !svnAudit.isZh", "group": "navigation@1" },
  { "command": 'svnAudit.newSession.zh', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && svnAudit.isZh", "group": "navigation@1" },
  
  { "command": 'svnAudit.refresh', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && !svnAudit.isZh", "group": "navigation@2" },
  { "command": 'svnAudit.refresh.zh', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isZh", "group": "navigation@2" },
  
  { "command": 'svnAudit.exportReport', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && !svnAudit.isZh", "group": "navigation@3" },
  { "command": 'svnAudit.exportReport.zh', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && svnAudit.isZh", "group": "navigation@3" },
  
  { "command": 'svnAudit.userManagement', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && svnAudit.isServerMode && !svnAudit.isZh", "group": "navigation@4" },
  { "command": 'svnAudit.userManagement.zh', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && svnAudit.isServerMode && svnAudit.isZh", "group": "navigation@4" },
  
  { "command": 'svnAudit.openSettings', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && !svnAudit.isZh", "group": "navigation@5" },
  { "command": 'svnAudit.openSettings.zh', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isZh", "group": "navigation@5" },
  
  { "command": 'svnAudit.logout', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && !svnAudit.isZh", "group": "navigation@6" },
  { "command": 'svnAudit.logout.zh', "when": "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isZh", "group": "navigation@6" }
]

mutatingCommands = {
    'svnAudit.markReviewed', 'svnAudit.markReviewed.zh',
    'svnAudit.markFlagged', 'svnAudit.markFlagged.zh',
    'svnAudit.aiAudit', 'svnAudit.aiAudit.zh',
    'svnAudit.deleteFile', 'svnAudit.deleteFile.zh',
    'svnAudit.deleteAuthor', 'svnAudit.deleteAuthor.zh',
    'svnAudit.aiAuditSelectModel', 'svnAudit.aiAuditSelectModel.zh',
    'svnAudit.aiAuditForce', 'svnAudit.aiAuditForce.zh',
    'svnAudit.aiAuditFull', 'svnAudit.aiAuditFull.zh',
    'svnAudit.addAuthorToSession', 'svnAudit.addAuthorToSession.zh',
    'svnAudit.renameSession', 'svnAudit.renameSession.zh',
    'svnAudit.deleteSession', 'svnAudit.deleteSession.zh',
    'svnAudit.editSummary', 'svnAudit.editSummary.zh',
    'svnAudit.editComment', 'svnAudit.editComment.zh',
    'svnAudit.deleteComment', 'svnAudit.deleteComment.zh',
    'svnAudit.addComment', 'svnAudit.addComment.zh'
}

for menu, items in pkg["contributes"]["menus"].items():
    if menu == 'view/title':
        continue
    for item in items:
        if item["command"] in mutatingCommands:
            if 'svnAudit.isReviewer' not in item.get('when', ''):
                item['when'] = item.get('when', '') + ' && svnAudit.isReviewer'

with open(path, 'w', encoding='utf-8') as f:
    json.dump(pkg, f, indent=2, ensure_ascii=False)

print('package.json updated')
