新建Session时，不想一步步的输入(地址， 人员，时间)，希望在新建Session时，弹窗一个界面，把这些信息都填进去，然后点击确定，就创建了一个Session，并且把创建的成功的信息保存在Sqlite中，下次可以直接选择这些信息，只要发现新输入在Sqlite中没有，则加入到Sqlite中。

Session列表面板需要做如下修改：
1. 创建完session后，在Session列表默认选择新创建的Session
2. 支持Session列表面板中的Session项的重命名session
