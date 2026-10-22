// Host overrides for the upstream workbench's exposed screens.
export const zh: Record<string, string> = {
  'dashboard.header.title': '文章工作台', 'dashboard.nav.manage': '文章列表',
  'app.logout': '退出登录', 'app.error.unknown': '读取失败，请重试。',
  'dashboard.userMenu.viewRepository': '查看内容来源',
  'dashboard.userMenu.serviceTooltip': '当前内容来源',
  'postList.loading': '正在读取文章…', 'postList.noPosts': '此集合暂无文章',
  'postList.searchPlaceholder': '搜索标题、标签或内容…',
  'postList.viewMode.grid': '卡片视图', 'postList.viewMode.table': '列表视图',
  'postList.updateFile': '替换文件（暂未开放）', 'postList.updateImage': '更换图片（暂未开放）',
  'postList.createButton': '新建文章（暂未开放）', 'postList.uploadButton': '导入文章（暂未开放）',
  'postList.pagination.prev': '上一页', 'postList.pagination.next': '下一页',
  'postList.pagination.pageInfo': '第 {{current}} / {{total}} 页',
  'postList.error.dirNotFound': '内容目录不存在：{{path}}',
  'postPreview.tabPreview': '预览', 'postPreview.delete': '删除（暂未开放）',
  'dashboard.setup.scanning': '正在读取工作台配置…',
};

export const editorZh: Record<string, string> = {
  'toolbar.blockTypeSelect.placeholder': '正文样式', 'toolbar.blockTypeSelect.selectBlockTypeTooltip': '选择正文样式',
  'toolbar.blockTypes.paragraph': '正文', 'toolbar.blockTypes.quote': '引用', 'toolbar.blockTypes.heading': '{{level}} 级标题',
  'toolbar.bold': '加粗', 'toolbar.italic': '斜体', 'toolbar.underline': '下划线',
  'toolbar.removeBold': '取消加粗', 'toolbar.removeItalic': '取消斜体', 'toolbar.removeUnderline': '取消下划线',
  'toolbar.bulletedList': '无序列表', 'toolbar.numberedList': '有序列表', 'toolbar.checkList': '任务列表',
  'toolbar.link': '插入链接', 'toolbar.image': '插入图片链接', 'toolbar.table': '插入表格', 'toolbar.codeBlock': '插入代码块',
  'toolbar.undo': '撤销 {{shortcut}}', 'toolbar.redo': '重做 {{shortcut}}',
};
export function translateEditor(key: string, fallback: string, values?: Record<string, unknown>) {
  return (editorZh[key] ?? fallback).replace(/{{(.*?)}}/g, (match, name) => String(values?.[name] ?? match));
}
