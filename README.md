新建Session时，不想一步步的输入(地址， 人员，时间)，希望在新建Session时，弹窗一个界面，把这些信息都填进去，然后点击确定，就创建了一个Session，并且把创建的成功的信息保存在Sqlite中，下次可以直接选择这些信息，只要发现新输入在Sqlite中没有，则加入到Sqlite中。

Session列表面板需要做如下修改：
1. 创建完session后，在Session列表默认选择新创建的Session
2. 支持Session列表面板中的Session项的重命名session

在Session列表面板中看不到对文件标记的类容，我需要增加如下需求：
1. 在对应的文件item下面新增一个子项目，子项类容是每条comment,点击后能够跳转到对应的comment位置
2. 在右边的diff view中对应行上以特殊显示，鼠标移动到行上的时候以hover tips的方式显示comment的内容


1. 在Session列表面板中，Session中的人员项的右边增加一个导出按钮，点击后能够像导出整个session功能一样，但是只导出当前人员的
2. 在Session列表面板中，Session中的人员项的右边增加一个删除按钮，点击后能够删除当前人员
3. 在Session列表面板中，Session中的人员项的右边增加一个总结按钮，点击后根据日志记录总结(如果不能自动总结，则将日志内容去重后导出，后续版本可能考虑接入AI来进行分析)工作内容，并导出为markdown文档

在Session列表面板中最顶部的按钮列表的最右边新增一个设置按钮，点击后打开设置界面，设置界面包含如下内容：
1. 将创建session时的SVN username和password移动到设置界面中，
2. 在设置界面中增加一个AI大模型列表（OpenAI, Qianwen, DeepSeek, Claude, Gemini, Kimi, GLM5）
3. 在设置界面中增加一个AI大模型API Key输入框，
4. 在设置界面新增一个编码规范输入框，里面会输入项目中的编码规范（命名，注释等相关的检查），内容可能会很多，用一个大点的区域
5. 设置面板的参数保存到Sqlite中，下次打开设置界面时，能够恢复上次的设置

在Session列表面板中，Session中的人员项的右边增加一个AI按钮，点击后能够自动根据提交记录中的文件修改内容，分析代码的编码规范(命名规则之类的，在设置界面会提供规范内容)和可能存在的BUG，代码存在的问题直接添加comment，和手动添加comment一样



