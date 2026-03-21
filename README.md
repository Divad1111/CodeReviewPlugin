新建Session时，不想一步步的输入(地址， 人员，时间)，希望在新建Session时，弹窗一个界面，把这些信息都填进去，然后点击确定，就创建了一个Session，并且把创建的成功的信息保存在Sqlite中，下次可以直接选择这些信息，只要发现新输入在Sqlite中没有，则加入到Sqlite中。

Session列表面板需要做如下修改：
1. 创建完session后，在Session列表默认选择新创建的Session
2. 支持Session列表面板中的Session项的重命名session

在Session列表面板中看不到对文件标记的类容，我需要增加如下需求：
1. 在对应的文件item下面新增一个子项目，子项类容是每条comment,点击后能够跳转到对应的comment位置
2. 在右边的diff view中对应行上以特殊显示，鼠标移动到行上的时候以hover tips的方式显示comment的内容
