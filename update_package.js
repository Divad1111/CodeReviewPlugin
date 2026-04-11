const fs = require('fs');
const path = './client/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));

// 1. Add new commands
const newCommands = [
  { command: 'svnAudit.login', title: 'Login / Start', icon: '$(sign-in)' },
  { command: 'svnAudit.login.zh', title: '登录 / 启动', icon: '$(sign-in)' },
  { command: 'svnAudit.logout', title: 'Logout', icon: '$(sign-out)' },
  { command: 'svnAudit.logout.zh', title: '退出登录', icon: '$(sign-out)' },
  { command: 'svnAudit.userManagement', title: 'User Management', icon: '$(organization)' },
  { command: 'svnAudit.userManagement.zh', title: '用户管理', icon: '$(organization)' }
];

const existingCmdIds = new Set(pkg.contributes.commands.map(c => c.command));
for (const cmd of newCommands) {
  if (!existingCmdIds.has(cmd.command)) {
    pkg.contributes.commands.push(cmd);
  }
}

// 2. Update view/title menus
// We want to reconstruct view/title with conditions
pkg.contributes.menus['view/title'] = [
  { command: 'svnAudit.login', when: "view == svnAuditSidebar && !svnAudit.isLoggedIn && !svnAudit.isZh", group: "navigation@0" },
  { command: 'svnAudit.login.zh', when: "view == svnAuditSidebar && !svnAudit.isLoggedIn && svnAudit.isZh", group: "navigation@0" },
  
  { command: 'svnAudit.newSession', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && !svnAudit.isZh", group: "navigation@1" },
  { command: 'svnAudit.newSession.zh', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && svnAudit.isZh", group: "navigation@1" },
  
  { command: 'svnAudit.refresh', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && !svnAudit.isZh", group: "navigation@2" },
  { command: 'svnAudit.refresh.zh', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isZh", group: "navigation@2" },
  
  { command: 'svnAudit.exportReport', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && !svnAudit.isZh", group: "navigation@3" },
  { command: 'svnAudit.exportReport.zh', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && svnAudit.isZh", group: "navigation@3" },
  
  { command: 'svnAudit.userManagement', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && svnAudit.isServerMode && !svnAudit.isZh", group: "navigation@4" },
  { command: 'svnAudit.userManagement.zh', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isReviewer && svnAudit.isServerMode && svnAudit.isZh", group: "navigation@4" },
  
  { command: 'svnAudit.openSettings', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && !svnAudit.isZh", group: "navigation@5" },
  { command: 'svnAudit.openSettings.zh', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isZh", group: "navigation@5" },
  
  { command: 'svnAudit.logout', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && !svnAudit.isZh", group: "navigation@6" },
  { command: 'svnAudit.logout.zh', when: "view == svnAuditSidebar && svnAudit.isLoggedIn && svnAudit.isZh", group: "navigation@6" }
];

// 3. Process context menus to require svnAudit.isReviewer for mutating operations
const mutatingCommands = new Set([
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
]);

for (const menu in pkg.contributes.menus) {
  if (menu === 'view/title') continue; // already handled
  
  pkg.contributes.menus[menu].forEach(item => {
    if (mutatingCommands.has(item.command)) {
      if (!item.when.includes('svnAudit.isReviewer')) {
        item.when = `${item.when} && svnAudit.isReviewer`;
      }
    }
  });
}

fs.writeFileSync(path, JSON.stringify(pkg, null, 2));
console.log('package.json updated');
