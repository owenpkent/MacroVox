# Markdown Viewer & File Browser Guide

**Created**: December 2024  
**Status**: Planning  
**Purpose**: Solutions for viewing Markdown and browsing files on Windows and Android

---

## Overview

This guide covers options for building or using **Markdown viewer** and **file browser** apps on both Windows and Android. These can be:

- **Standalone apps** (separate from MacroVox Cloud)
- **Companion apps** that connect to MacroVox Cloud workspaces
- **Existing apps** that meet the requirements

---

## Requirements

| Feature | Windows | Android |
|---------|---------|---------|
| View Markdown with rendering | ✅ Required | ✅ Required |
| Browse local files | ✅ Required | ✅ Required |
| GitHub repo browsing | Nice to have | Nice to have |
| Edit Markdown | Nice to have | Nice to have |
| Dark mode | ✅ Required | ✅ Required |
| Accessibility (large text, TalkBack) | ✅ Required | ✅ Required |

---

## Option 1: Use Existing Apps (Quickest)

### Windows: Recommended Apps

#### A. **Obsidian** (Best Overall)
- Free for personal use
- Excellent Markdown rendering
- Built-in file browser
- Plugin ecosystem
- Dark mode

```
Download: https://obsidian.md
```

#### B. **Typora** ($15 one-time)
- Clean WYSIWYG Markdown
- File tree sidebar
- Multiple themes
- Export to PDF/HTML

#### C. **Mark Text** (Free, Open Source)
- Real-time preview
- File browser sidebar
- GitHub-flavored Markdown
- Dark/light themes

```
Download: https://github.com/marktext/marktext/releases
```

#### D. **VS Code + Extensions**
- Markdown Preview Enhanced extension
- Built-in file explorer
- Git integration
- Free

### Android: Recommended Apps

#### A. **Obsidian Mobile** (Best Overall)
- Same features as desktop
- Sync with desktop via Obsidian Sync or folder sync
- Dark mode
- Free

#### B. **Markor** (Free, Open Source)
- Markdown editor + viewer
- File browser
- No account required
- Works offline

```
Download: https://github.com/gsantner/markor
Play Store: https://play.google.com/store/apps/details?id=net.gsantner.markor
```

#### C. **iA Writer** ($30 one-time)
- Premium Markdown experience
- File browser
- Focus mode
- Sync with iCloud/Dropbox

#### D. **Epsilon Notes** (Free)
- GitHub-flavored Markdown
- Tree file browser
- Syntax highlighting
- Material Design

---

## Option 2: Build Lightweight Viewer Apps

If existing apps don't meet accessibility/customization needs, build minimal focused apps.

### Windows App (WPF/WinUI 3)

**Tech Stack**:
- WinUI 3 or WPF (.NET 8)
- Markdig for Markdown parsing
- WebView2 for rendering

**Project Structure**:
```
MarkdownViewer/
├── MarkdownViewer.sln
├── src/
│   ├── App.xaml
│   ├── MainWindow.xaml
│   ├── Views/
│   │   ├── FileBrowserView.xaml
│   │   └── MarkdownView.xaml
│   ├── ViewModels/
│   │   ├── FileBrowserViewModel.cs
│   │   └── MarkdownViewModel.cs
│   └── Services/
│       ├── FileService.cs
│       └── MarkdownService.cs
└── assets/
    └── styles.css
```

**Core Implementation**:

```csharp
// MarkdownService.cs
using Markdig;

public class MarkdownService
{
    private readonly MarkdownPipeline _pipeline;
    
    public MarkdownService()
    {
        _pipeline = new MarkdownPipelineBuilder()
            .UseAdvancedExtensions()
            .UseEmojiAndSmiley()
            .UseTaskLists()
            .UseSyntaxHighlighting()
            .Build();
    }
    
    public string RenderToHtml(string markdown)
    {
        var html = Markdown.ToHtml(markdown, _pipeline);
        return WrapWithTemplate(html);
    }
    
    private string WrapWithTemplate(string content)
    {
        return $@"
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ 
            font-family: 'Segoe UI', sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
            background: var(--bg-color, #1e1e1e);
            color: var(--text-color, #d4d4d4);
        }}
        code {{
            background: #2d2d2d;
            padding: 2px 6px;
            border-radius: 3px;
        }}
        pre code {{
            display: block;
            padding: 16px;
            overflow-x: auto;
        }}
    </style>
</head>
<body>{content}</body>
</html>";
    }
}
```

```xml
<!-- MainWindow.xaml -->
<Window x:Class="MarkdownViewer.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        Title="Markdown Viewer" Height="800" Width="1200">
    <Grid>
        <Grid.ColumnDefinitions>
            <ColumnDefinition Width="250"/>
            <ColumnDefinition Width="*"/>
        </Grid.ColumnDefinitions>
        
        <!-- File Browser -->
        <TreeView x:Name="FileTree" Grid.Column="0"
                  ItemsSource="{Binding RootItems}"
                  SelectedItemChanged="OnFileSelected">
            <TreeView.ItemTemplate>
                <HierarchicalDataTemplate ItemsSource="{Binding Children}">
                    <StackPanel Orientation="Horizontal">
                        <TextBlock Text="{Binding Icon}" Margin="0,0,8,0"/>
                        <TextBlock Text="{Binding Name}"/>
                    </StackPanel>
                </HierarchicalDataTemplate>
            </TreeView.ItemTemplate>
        </TreeView>
        
        <!-- Markdown Preview -->
        <WebView2 x:Name="MarkdownPreview" Grid.Column="1"/>
    </Grid>
</Window>
```

```csharp
// MainWindow.xaml.cs
public partial class MainWindow : Window
{
    private readonly MarkdownService _markdown = new();
    
    private async void OnFileSelected(object sender, RoutedEventArgs e)
    {
        if (FileTree.SelectedItem is FileItem file && file.IsMarkdown)
        {
            var content = await File.ReadAllTextAsync(file.FullPath);
            var html = _markdown.RenderToHtml(content);
            await MarkdownPreview.EnsureCoreWebView2Async();
            MarkdownPreview.NavigateToString(html);
        }
    }
}
```

**Dependencies (NuGet)**:
```xml
<ItemGroup>
    <PackageReference Include="Markdig" Version="0.34.0" />
    <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.2210.55" />
    <PackageReference Include="CommunityToolkit.Mvvm" Version="8.2.2" />
</ItemGroup>
```

---

### Android App (Kotlin + Compose)

**Tech Stack**:
- Kotlin
- Jetpack Compose
- Markwon for Markdown rendering
- Material 3

**Project Structure**:
```
MarkdownViewer/
├── app/
│   ├── build.gradle.kts
│   └── src/main/
│       ├── java/com/macrovox/mdviewer/
│       │   ├── MainActivity.kt
│       │   ├── ui/
│       │   │   ├── FileBrowserScreen.kt
│       │   │   ├── MarkdownViewerScreen.kt
│       │   │   └── theme/
│       │   └── data/
│       │       ├── FileRepository.kt
│       │       └── MarkdownRenderer.kt
│       └── res/
└── build.gradle.kts
```

**Core Implementation**:

```kotlin
// MarkdownRenderer.kt
import io.noties.markwon.Markwon
import io.noties.markwon.ext.tables.TablePlugin
import io.noties.markwon.ext.tasklist.TaskListPlugin
import io.noties.markwon.syntax.Prism4jThemeDarkula
import io.noties.markwon.syntax.SyntaxHighlightPlugin

class MarkdownRenderer(context: Context) {
    
    private val markwon = Markwon.builder(context)
        .usePlugin(TablePlugin.create(context))
        .usePlugin(TaskListPlugin.create(context))
        .usePlugin(SyntaxHighlightPlugin.create(
            Prism4j(GrammarLocator()),
            Prism4jThemeDarkula.create()
        ))
        .build()
    
    fun render(markdown: String): Spanned {
        return markwon.toMarkdown(markdown)
    }
}
```

```kotlin
// FileBrowserScreen.kt
@Composable
fun FileBrowserScreen(
    currentPath: String,
    onFileSelected: (File) -> Unit,
    onNavigate: (String) -> Unit
) {
    val files = remember(currentPath) {
        File(currentPath).listFiles()
            ?.sortedWith(compareBy({ !it.isDirectory }, { it.name.lowercase() }))
            ?: emptyList()
    }
    
    LazyColumn(
        modifier = Modifier.fillMaxSize()
    ) {
        // Parent directory
        if (currentPath != Environment.getExternalStorageDirectory().path) {
            item {
                FileItem(
                    icon = Icons.Default.ArrowBack,
                    name = "..",
                    onClick = { onNavigate(File(currentPath).parent ?: currentPath) }
                )
            }
        }
        
        items(files) { file ->
            FileItem(
                icon = if (file.isDirectory) Icons.Default.Folder 
                       else Icons.Default.Description,
                name = file.name,
                onClick = {
                    if (file.isDirectory) {
                        onNavigate(file.absolutePath)
                    } else if (file.extension in listOf("md", "markdown", "txt")) {
                        onFileSelected(file)
                    }
                }
            )
        }
    }
}

@Composable
fun FileItem(
    icon: ImageVector,
    name: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = name,
            style = MaterialTheme.typography.bodyLarge
        )
    }
}
```

```kotlin
// MarkdownViewerScreen.kt
@Composable
fun MarkdownViewerScreen(
    file: File,
    renderer: MarkdownRenderer,
    onBack: () -> Unit
) {
    val content = remember(file) {
        file.readText()
    }
    val rendered = remember(content) {
        renderer.render(content)
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(file.name) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { padding ->
        AndroidView(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            factory = { context ->
                TextView(context).apply {
                    textSize = 16f
                    setTextColor(context.getColor(R.color.text_primary))
                }
            },
            update = { textView ->
                textView.text = rendered
            }
        )
    }
}
```

```kotlin
// MainActivity.kt
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val renderer = MarkdownRenderer(this)
        
        setContent {
            MarkdownViewerTheme {
                var currentPath by remember { 
                    mutableStateOf(Environment.getExternalStorageDirectory().path) 
                }
                var selectedFile by remember { mutableStateOf<File?>(null) }
                
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    if (selectedFile != null) {
                        MarkdownViewerScreen(
                            file = selectedFile!!,
                            renderer = renderer,
                            onBack = { selectedFile = null }
                        )
                    } else {
                        FileBrowserScreen(
                            currentPath = currentPath,
                            onFileSelected = { selectedFile = it },
                            onNavigate = { currentPath = it }
                        )
                    }
                }
            }
        }
    }
}
```

**Dependencies (build.gradle.kts)**:
```kotlin
dependencies {
    implementation("io.noties.markwon:core:4.6.2")
    implementation("io.noties.markwon:ext-tables:4.6.2")
    implementation("io.noties.markwon:ext-tasklist:4.6.2")
    implementation("io.noties.markwon:syntax-highlight:4.6.2")
    implementation("io.noties:prism4j:2.0.0")
    
    implementation("androidx.compose.ui:ui:1.5.4")
    implementation("androidx.compose.material3:material3:1.1.2")
    implementation("androidx.activity:activity-compose:1.8.1")
}
```

---

## Option 3: Cross-Platform App (Single Codebase)

Build once, run on both Windows and Android.

### A. **Flutter**

```dart
// lib/main.dart
import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'dart:io';

void main() => runApp(MarkdownViewerApp());

class MarkdownViewerApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Markdown Viewer',
      theme: ThemeData.dark(),
      home: FileBrowserScreen(),
    );
  }
}

class FileBrowserScreen extends StatefulWidget {
  @override
  _FileBrowserScreenState createState() => _FileBrowserScreenState();
}

class _FileBrowserScreenState extends State<FileBrowserScreen> {
  String currentPath = '/';
  
  @override
  void initState() {
    super.initState();
    _initPath();
  }
  
  Future<void> _initPath() async {
    if (Platform.isAndroid) {
      currentPath = '/storage/emulated/0';
    } else if (Platform.isWindows) {
      currentPath = Platform.environment['USERPROFILE'] ?? 'C:\\';
    }
    setState(() {});
  }
  
  @override
  Widget build(BuildContext context) {
    final dir = Directory(currentPath);
    final items = dir.listSync()
      ..sort((a, b) {
        if (a is Directory && b is! Directory) return -1;
        if (a is! Directory && b is Directory) return 1;
        return a.path.compareTo(b.path);
      });
    
    return Scaffold(
      appBar: AppBar(title: Text('Files')),
      body: ListView.builder(
        itemCount: items.length,
        itemBuilder: (context, index) {
          final item = items[index];
          final isDir = item is Directory;
          final name = item.path.split(Platform.pathSeparator).last;
          
          return ListTile(
            leading: Icon(isDir ? Icons.folder : Icons.description),
            title: Text(name),
            onTap: () {
              if (isDir) {
                setState(() => currentPath = item.path);
              } else if (name.endsWith('.md')) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => MarkdownViewerScreen(file: item as File),
                  ),
                );
              }
            },
          );
        },
      ),
    );
  }
}

class MarkdownViewerScreen extends StatelessWidget {
  final File file;
  
  const MarkdownViewerScreen({required this.file});
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(file.path.split(Platform.pathSeparator).last),
      ),
      body: FutureBuilder<String>(
        future: file.readAsString(),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return Center(child: CircularProgressIndicator());
          }
          return Markdown(
            data: snapshot.data!,
            selectable: true,
            styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)),
          );
        },
      ),
    );
  }
}
```

**Dependencies (pubspec.yaml)**:
```yaml
dependencies:
  flutter:
    sdk: flutter
  flutter_markdown: ^0.6.18
  path_provider: ^2.1.1
  permission_handler: ^11.0.1
```

### B. **React Native**

```jsx
// App.js
import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import RNFS from 'react-native-fs';

export default function App() {
  const [currentPath, setCurrentPath] = useState(RNFS.DocumentDirectoryPath);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [content, setContent] = useState('');

  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  const loadFiles = async () => {
    const items = await RNFS.readDir(currentPath);
    setFiles(items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    }));
  };

  const openFile = async (file) => {
    if (file.isDirectory()) {
      setCurrentPath(file.path);
    } else if (file.name.endsWith('.md')) {
      const text = await RNFS.readFile(file.path);
      setContent(text);
      setSelectedFile(file);
    }
  };

  if (selectedFile) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => setSelectedFile(null)}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Markdown style={markdownStyles}>{content}</Markdown>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={files}
        keyExtractor={(item) => item.path}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.item} 
            onPress={() => openFile(item)}
          >
            <Text style={styles.icon}>
              {item.isDirectory() ? '📁' : '📄'}
            </Text>
            <Text style={styles.name}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1e1e1e', paddingTop: 50 },
  item: { flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: '#333' },
  icon: { fontSize: 20, marginRight: 12 },
  name: { color: '#fff', fontSize: 16 },
  back: { color: '#4fc3f7', padding: 16, fontSize: 16 },
});

const markdownStyles = {
  body: { color: '#d4d4d4', padding: 16 },
  heading1: { color: '#fff' },
  code_inline: { backgroundColor: '#2d2d2d' },
};
```

### C. **Tauri (Rust + Web)**

Lightweight, native performance, single binary.

```rust
// src-tauri/src/main.rs
use std::fs;
use std::path::PathBuf;

#[tauri::command]
fn read_directory(path: String) -> Result<Vec<FileInfo>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| e.to_string())?;
    
    let mut files: Vec<FileInfo> = entries
        .filter_map(|e| e.ok())
        .map(|e| FileInfo {
            name: e.file_name().to_string_lossy().to_string(),
            path: e.path().to_string_lossy().to_string(),
            is_dir: e.path().is_dir(),
        })
        .collect();
    
    files.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });
    
    Ok(files)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct FileInfo {
    name: String,
    path: String,
    is_dir: bool,
}
```

```html
<!-- src/index.html -->
<!DOCTYPE html>
<html>
<head>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <style>
        body { 
            font-family: system-ui; 
            background: #1e1e1e; 
            color: #d4d4d4;
            margin: 0;
            display: flex;
        }
        .sidebar { width: 250px; border-right: 1px solid #333; height: 100vh; overflow-y: auto; }
        .file { padding: 8px 16px; cursor: pointer; }
        .file:hover { background: #2d2d2d; }
        .folder { color: #4fc3f7; }
        .content { flex: 1; padding: 20px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="sidebar" id="files"></div>
    <div class="content" id="preview"></div>
    <script>
        const { invoke } = window.__TAURI__.tauri;
        
        let currentPath = '';
        
        async function loadDir(path) {
            currentPath = path;
            const files = await invoke('read_directory', { path });
            document.getElementById('files').innerHTML = files
                .map(f => `<div class="file ${f.is_dir ? 'folder' : ''}" 
                    onclick="${f.is_dir ? `loadDir('${f.path}')` : `loadFile('${f.path}')`}">
                    ${f.is_dir ? '📁' : '📄'} ${f.name}
                </div>`)
                .join('');
        }
        
        async function loadFile(path) {
            const content = await invoke('read_file', { path });
            document.getElementById('preview').innerHTML = marked.parse(content);
        }
        
        // Initialize with home directory
        loadDir(await invoke('get_home_dir'));
    </script>
</body>
</html>
```

---

## Comparison Summary

| Approach | Windows | Android | Dev Time | Maintenance |
|----------|---------|---------|----------|-------------|
| **Use existing apps** | ✅ Obsidian/Mark Text | ✅ Markor/Obsidian | None | None |
| **Native per platform** | WPF/WinUI | Kotlin/Compose | 2-3 weeks each | Higher |
| **Flutter** | ✅ | ✅ | 2 weeks | Medium |
| **React Native** | ⚠️ (via Windows) | ✅ | 2 weeks | Medium |
| **Tauri** | ✅ | ❌ (no Android) | 1-2 weeks | Lower |

---

## Recommendation

### For Immediate Use
- **Windows**: Install **Obsidian** or **Mark Text** (free, open source)
- **Android**: Install **Markor** (free, open source) or **Obsidian Mobile**

### For Custom Development
- **If accessibility customization needed**: Build native apps (WPF + Kotlin)
- **If time is limited**: Use **Flutter** for both platforms
- **If Windows-only**: Use **Tauri** for smallest binary size

### For MacroVox Integration
The Android app design doc already includes file browser and Markdown viewer. These standalone apps could:

1. **Sync folders** with MacroVox Android via shared storage
2. **Use GitHub API** to browse the same repos
3. **Share voice recordings** for transcription

---

## Related Documents

- [Android App Design](../android-app/design-doc.md)
- [CLI AI Integration Guide](./cli-ai-integration-guide.md)
- [Cloud IDE Proposal](./cloud-ide-proposal.md)

---

*Document Version: 1.0*  
*Created: December 2024*
