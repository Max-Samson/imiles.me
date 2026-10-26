import { CollectionToolbar } from '../../integration/components/CollectionToolbar';
/**
 * Dashboard Component
 * 
 * TD-07: Refactored from 1246-line God Component to ~350-line layout component.
 * Business logic extracted to:
 * - useDashboardInit: settings, sync, scan, stats
 * - useConfigManager: save, export, import, delete, setup
 */

import React, { useState, useEffect } from "react";
import {
  type GithubUser,
  type GithubRepo,
  type IGitService,
  type ServiceType,
} from "../types";
import {
  useNavigation,
  type ViewType,
  useAppStore,
  useSettingsStore,
  useCollectionStore,
  saveCollectionsToPageelrc,
  type Collection,
  withSyncLock,
} from "../features";
import { useDashboardInit } from "../hooks/useDashboardInit";
import { useConfigManager } from "../hooks/useConfigManager";
import PostList from "./PostList";
import CreatePostWrapper from "./CreatePostWrapper";
import ImageList from "./ImageList";
import { SettingsIcon } from "./icons/SettingsIcon";
import { SpinnerIcon } from "./icons/SpinnerIcon";
import BackupManager from "./BackupManager";
import TemplateGenerator from "./TemplateGenerator";
import { useI18n } from "../i18n/I18nContext";
import { DocumentIcon } from "./icons/DocumentIcon";
import { ImageIcon } from "./icons/ImageIcon";
import { DownloadIcon } from "./icons/DownloadIcon";
import { MenuIcon } from "./icons/MenuIcon";
import DirectoryPicker from "./DirectoryPicker";
import { DatabaseIcon } from "./icons/DatabaseIcon";
import { BoardIcon } from "./icons/BoardIcon";
import { TemplateIcon } from "./icons/TemplateIcon";
import { Sidebar } from "./Sidebar";
import { SetupWizard } from "./SetupWizard";
import { SettingsView } from "./SettingsView";
import { PluginsView } from "./PluginsView";
import { PuzzleIcon } from "./icons/PuzzleIcon";
import { SyncStatusBadge } from "./SyncStatusBadge";
import { ExclamationTriangleIcon } from "./icons/ExclamationTriangleIcon";
import { NewCollectionModal } from "./NewCollectionModal";
import { EditCollectionModal } from "./EditCollectionModal";
import { PluginConfigProvider } from "../plugins";

// --- MAIN DASHBOARD ---
interface DashboardProps {
  /** 嵌入宿主后台时，由宿主管理导航、账户与页面高度。 */
  embedded?: boolean;
  gitService: IGitService;
  repo: GithubRepo;
  user: GithubUser;
  serviceType: ServiceType;
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({
  embedded = false,
  gitService,
  repo,
  user,
  serviceType,
  onLogout,
}) => {
  // Zustand stores
  const {
    activeView,
    setView,
    isSidebarOpen,
    setSidebarOpen,
    isScanning,
    repoStats,
    scanPhase,
    scanProgress,
  } = useAppStore();
  const { isSaving, saveSuccess, isSetupComplete } = useSettingsStore();
  const { workspace, getActiveCollection } = useCollectionStore();
  const activeCollection = getActiveCollection();

  // TD-07: Extracted hooks
  const {
    settings,
    setSettings,
    effectivePostsPath,
    effectiveImagesPath,
    suggestedPostPaths,
    suggestedImagePaths,
    currentRepo,
    isSynced,
    handleAction,
    fetchStats,
    pluginConfig,
    setPluginConfig,
  } = useDashboardInit({ gitService, repo });

  const {
    handleSettingsChange,
    handleSaveSettings,
    handleExportSettings,
    handleImportClick,
    handleFileImport,
    importFileInputRef,
    importExportStatus,
    handleDeleteConfig,
    handleFinishSetup,
  } = useConfigManager({ gitService, repo, settings, handleAction });

  // Local UI state
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false);
  const [isEditCollectionModalOpen, setIsEditCollectionModalOpen] = useState(false);
  const [collectionToEdit, setCollectionToEdit] = useState<Collection | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState<"posts" | "images" | null>(null);
  const [collectionPathPicker, setCollectionPathPicker] = useState<{
    type: "posts" | "images";
    callback: (path: string) => void;
  } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditingPost, setIsEditingPost] = useState(false);

  const { t, language } = useI18n();

  // Auto-clear success message
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Collection handlers
  const handleCollectionCreated = async () => {
    const latestWorkspace = useCollectionStore.getState().workspace;
    if (latestWorkspace) {
      await withSyncLock(
        () => saveCollectionsToPageelrc(gitService, latestWorkspace),
        "Saving collection...",
      );
      setSuccessMessage(t("dashboard.success.collectionCreated"));
      setIsNewCollectionModalOpen(false);
    }
  };

  const handleEditCollection = (collection: Collection) => {
    setCollectionToEdit(collection);
    setIsEditCollectionModalOpen(true);
  };

  const handleCollectionUpdated = async () => {
    const latestWorkspace = useCollectionStore.getState().workspace;
    if (latestWorkspace) {
      await withSyncLock(
        () => saveCollectionsToPageelrc(gitService, latestWorkspace),
        "Updating collection...",
      );
      setSuccessMessage(t("dashboard.success.collectionUpdated"));
      setIsEditCollectionModalOpen(false);
    }
  };

  const handleDeleteCollection = async () => {
    const latestWorkspace = useCollectionStore.getState().workspace;
    if (latestWorkspace) {
      await withSyncLock(
        () => saveCollectionsToPageelrc(gitService, latestWorkspace),
        "Deleting collection...",
      );
      setSuccessMessage(t("dashboard.success.collectionDeleted"));
    }
  };

  const handleMobileNavClick = (view: string) => {
    setView(view as ViewType);
    setSidebarOpen(false);
  };

  // Scanning state
  if (isScanning) {
    return (
      <div className="flex justify-center items-center h-screen flex-col bg-white">
        <SpinnerIcon className="animate-spin h-8 w-8 text-notion-text mb-4" />
        <p className="text-notion-muted">{t("dashboard.setup.scanning")}</p>
      </div>
    );
  }

  // Setup wizard
  if (!isSetupComplete) {
    return (
      <SetupWizard
        gitService={gitService}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        suggestedPostPaths={suggestedPostPaths}
        suggestedImagePaths={suggestedImagePaths}
        onFinish={handleFinishSetup}
      />
    );
  }

  // Navigation
  const navLinks = [
    { id: "dashboard", label: t("dashboard.nav.manage"), icon: DatabaseIcon },
    { id: "images", label: t("dashboard.nav.manageImages"), icon: ImageIcon },
    { id: "template", label: t("dashboard.nav.template"), icon: TemplateIcon },
    { id: "workflows", label: t("dashboard.nav.workflows"), icon: BoardIcon },
    ...(pluginConfig?.plugins?.enabled ? [{ id: "plugins", label: "Plugins", icon: PuzzleIcon }] : []),
    { id: "backup", label: t("dashboard.nav.backup"), icon: DownloadIcon },
    { id: "settings", label: t("dashboard.nav.settings"), icon: SettingsIcon },
  ].filter((link) => link.id === 'dashboard');

  const getPageIcon = () => {
    const icons: Record<string, React.ReactNode> = {
      dashboard: <DatabaseIcon className="cms-page-heading-icon text-notion-text" />,
      images: <ImageIcon className="cms-page-heading-icon text-notion-text" />,
      template: <TemplateIcon className="cms-page-heading-icon text-notion-text" />,
      workflows: <BoardIcon className="cms-page-heading-icon text-notion-text" />,
      plugins: <PuzzleIcon className="cms-page-heading-icon text-notion-text" />,
      backup: <DownloadIcon className="cms-page-heading-icon text-notion-text" />,
      settings: <SettingsIcon className="cms-page-heading-icon text-notion-text" />,
    };
    return icons[activeView] || <DocumentIcon className="cms-page-heading-icon text-notion-text" />;
  };

  const getPageTitle = () => {
    const titles: Record<string, string> = {
      dashboard: t("dashboard.header.title"),
      images: t("dashboard.nav.manageImages"),
      template: t("dashboard.nav.template"),
      workflows: t("dashboard.nav.workflows"),
      plugins: "Plugins",
      backup: t("dashboard.nav.backup"),
      settings: t("dashboard.nav.settings"),
    };
    return titles[activeView] || "";
  };

  // 宿主仅开放文章列表；原 switch('dashboard') 的其他分支永远不可达。
  // 直接表达既有行为，避免为通过类型检查意外重新开放上游管理页面。
  const renderContent = () => (
    <PostList
      key={activeCollection?.id}
      gitService={gitService}
      repo={currentRepo}
      onPostUpdate={fetchStats}
      onAction={handleAction}
      onEditingChange={setIsEditingPost}
    />
  );

  const lastUpdated = currentRepo.pushed_at
    ? new Date(currentRepo.pushed_at).toLocaleString(
        language === "vi" ? "vi-VN" : "en-US",
      )
    : "...";

  return (
    <PluginConfigProvider config={pluginConfig}>
    <div className="cms-workbench flex h-screen bg-notion-bg font-sans overflow-hidden text-notion-text">
      {/* Mobile Sidebar Overlay */}
      {!embedded && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* 独立模式保留上游导航；嵌入模式仅显示内容工作区。 */}
      {!embedded && <div
        className={`fixed inset-y-0 left-0 z-30 w-60 transform bg-notion-sidebar transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <Sidebar
          activeView={activeView}
          onNavClick={handleMobileNavClick}
          navLinks={navLinks}
          user={user}
          serviceType={serviceType}
          repoName={currentRepo.name}
          repoUrl={currentRepo.html_url}
          onLogout={onLogout}
          isSynced={isSynced}
          repoStats={repoStats}
          lastUpdated={lastUpdated}
          onNewCollection={() => setIsNewCollectionModalOpen(true)}
          onEditCollection={handleEditCollection}
          onDeleteCollection={handleDeleteCollection}
        />
      </div>

      }
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-notion-bg">
        {/* Sync Warning Banner */}
        {!isSynced && (
          <div className="bg-white border-b border-notion-border px-4 py-2 flex items-center justify-center sticky top-0 z-40 shadow-sm animate-fade-in text-xs">
            <div className="flex items-center text-yellow-600">
              <ExclamationTriangleIcon className="h-3.5 w-3.5 mr-2" />
              <span>{t("dashboard.sync.syncing")}</span>
            </div>
          </div>
        )}

        {/* Top Bar - Mobile */}
        {!embedded && <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border lg:hidden bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-notion-text hover:text-notion-text/70"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <h2 className="text-sm font-semibold text-notion-text truncate">
            {repo.name}
          </h2>
          <div className="flex items-center flex-shrink-0 ml-2">
            <SyncStatusBadge isSynced={isSynced} />
          </div>
        </div>

        }
        <main className={`flex-1 ${isEditingPost ? 'overflow-hidden' : 'overflow-y-auto'} bg-notion-bg text-notion-text transition-colors`}>
          <div className={isEditingPost ? 'w-full h-full' : 'w-full mx-auto py-8 px-4 sm:px-6 lg:px-6'}>
            {/* Unified Page Header matching Admin Console */}
            {!isEditingPost && (
              <div className="cms-page-heading mb-8 group">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {getPageIcon()}
                    <div>
                      <h1 className="text-2xl font-bold text-notion-text tracking-tight md:text-3xl flex items-center gap-2.5">
                        <span>{getPageTitle()}</span>
                        <span className="flex size-2 animate-pulse rounded-full bg-emerald-500 shrink-0" title="服务已就绪" />
                      </h1>
                      <p className="text-xs text-notion-muted hidden sm:block mt-0.5">
                        全站内容管理 · 支持 MDX 交互组件与双语文章编排
                      </p>
                    </div>
                  </div>

                  {embedded && <CollectionToolbar />}
                </div>
              </div>
            )}

            {renderContent()}
          </div>
        </main>
      </div>

      {isPickerOpen && (
        <DirectoryPicker
          gitService={gitService}
          repo={currentRepo}
          initialPath=""
          onSelect={(path) => {
            handleSettingsChange(
              isPickerOpen === "posts" ? "postsPath" : "imagesPath",
              path,
            );
            setIsPickerOpen(null);
          }}
          onClose={() => setIsPickerOpen(null)}
        />
      )}

      {collectionPathPicker && (
        <DirectoryPicker
          gitService={gitService}
          repo={currentRepo}
          initialPath=""
          onSelect={(path) => {
            collectionPathPicker.callback(path);
            setCollectionPathPicker(null);
          }}
          onClose={() => setCollectionPathPicker(null)}
        />
      )}

      {successMessage && (
        <div className="fixed bottom-20 right-6 z-50 bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-md shadow-lg animate-fade-in flex items-center text-sm">
          <span>{successMessage}</span>
        </div>
      )}

      <NewCollectionModal
        isOpen={isNewCollectionModalOpen}
        onClose={() => setIsNewCollectionModalOpen(false)}
        onCreated={handleCollectionCreated}
        onSelectPath={(type, callback) => setCollectionPathPicker({ type, callback })}
      />

      {collectionToEdit && (
        <EditCollectionModal
          isOpen={isEditCollectionModalOpen}
          onClose={() => {
            setIsEditCollectionModalOpen(false);
            setCollectionToEdit(null);
          }}
          onUpdated={handleCollectionUpdated}
          collection={collectionToEdit}
          onSelectPath={(type, callback) => setCollectionPathPicker({ type, callback })}
        />
      )}
    </div>
    </PluginConfigProvider>
  );
};

export default Dashboard;
