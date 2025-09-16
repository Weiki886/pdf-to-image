// 全局变量
let currentPDF = null;
let convertedImages = [];
let currentFile = null;

// DOM元素
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const settingsSection = document.getElementById('settingsSection');
const progressSection = document.getElementById('progressSection');
const resultSection = document.getElementById('resultSection');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const previewArea = document.getElementById('previewArea');
const outputFormat = document.getElementById('outputFormat');
const imageFormat = document.getElementById('imageFormat');
const quality = document.getElementById('quality');
const qualityValue = document.getElementById('qualityValue');

// 设置PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    updateQualityDisplay();
});

// 事件监听器设置
function initializeEventListeners() {
    // 文件上传区域点击
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // 文件选择
    fileInput.addEventListener('change', handleFileSelect);

    // 拖拽上传
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleFileDrop);

    // 转换按钮
    convertBtn.addEventListener('click', startConversion);

    // 下载按钮
    downloadBtn.addEventListener('click', downloadImages);

    // 重置按钮
    resetBtn.addEventListener('click', resetApplication);

    // 质量滑块
    quality.addEventListener('input', updateQualityDisplay);

    // 阻止页面默认拖拽行为
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        processSelectedFile(file);
    }
}

// 处理拖拽悬停
function handleDragOver(event) {
    event.preventDefault();
    uploadArea.classList.add('dragover');
}

// 处理拖拽离开
function handleDragLeave(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
}

// 处理文件拖拽放置
function handleFileDrop(event) {
    event.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        processSelectedFile(files[0]);
    }
}

// 处理选中的文件
function processSelectedFile(file) {
    // 验证文件类型
    if (file.type !== 'application/pdf') {
        alert('请选择PDF文件！');
        return;
    }

    // 验证文件大小 (50MB)
    if (file.size > 50 * 1024 * 1024) {
        alert('文件大小不能超过50MB！');
        return;
    }

    currentFile = file;
    
    // 显示文件信息
    updateUploadAreaWithFile(file);
    
    // 显示设置区域
    settingsSection.style.display = 'block';
    
    // 滚动到设置区域
    settingsSection.scrollIntoView({ behavior: 'smooth' });
}

// 更新上传区域显示文件信息
function updateUploadAreaWithFile(file) {
    const uploadContent = uploadArea.querySelector('.upload-content');
    uploadContent.innerHTML = `
        <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"></path>
        </svg>
        <h3>已选择文件</h3>
        <p><strong>${file.name}</strong></p>
        <p>文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
        <p style="color: #28a745; font-weight: 600;">点击可重新选择文件</p>
    `;
}

// 更新质量显示
function updateQualityDisplay() {
    qualityValue.textContent = quality.value + 'x';
}

// 获取不含扩展名的文件名
function getFileNameWithoutExtension(filename) {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.slice(0, lastDotIndex) : filename;
}

// 开始转换
async function startConversion() {
    if (!currentFile) {
        alert('请先选择PDF文件！');
        return;
    }

    try {
        convertBtn.disabled = true;
        convertBtn.textContent = '转换中...';
        
        // 显示进度区域
        progressSection.style.display = 'block';
        progressSection.scrollIntoView({ behavior: 'smooth' });
        
        // 重置结果
        convertedImages = [];
        
        await convertPDFToImages(currentFile);
        
    } catch (error) {
        console.error('转换失败:', error);
        alert('转换失败: ' + error.message);
        resetConversionState();
    }
}

// PDF转图片核心函数
async function convertPDFToImages(file) {
    updateProgress(0, '正在加载PDF文件...');
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    currentPDF = pdf;
    
    const totalPages = pdf.numPages;
    const scale = parseFloat(quality.value);
    const format = imageFormat.value;
    const isLongImage = outputFormat.value === 'long';
    
    updateProgress(10, `PDF文件加载完成，共${totalPages}页`);
    
    if (isLongImage) {
        // 生成长图
        await generateLongImage(pdf, totalPages, scale, format);
    } else {
        // 生成分页图片
        await generateSeparateImages(pdf, totalPages, scale, format);
    }
    
    // 显示结果
    showResults();
}

// 生成分页图片
async function generateSeparateImages(pdf, totalPages, scale, format) {
    const pdfBaseName = getFileNameWithoutExtension(currentFile.name);
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        updateProgress(10 + (pageNum / totalPages) * 80, `正在转换第${pageNum}页，共${totalPages}页...`);
        
        const page = await pdf.getPage(pageNum);
        const canvas = await renderPageToCanvas(page, scale);
        
        const imageData = canvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.9 : undefined);
        convertedImages.push({
            data: imageData,
            name: `${pdfBaseName}_page_${pageNum.toString().padStart(3, '0')}.${format}`,
            canvas: canvas
        });
    }
    
    updateProgress(100, `转换完成！生成了${totalPages}张图片`);
}

// 生成长图
async function generateLongImage(pdf, totalPages, scale, format) {
    const pages = [];
    let totalHeight = 0;
    let maxWidth = 0;
    
    // 渲染所有页面
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        updateProgress(10 + (pageNum / totalPages) * 60, `正在渲染第${pageNum}页...`);
        
        const page = await pdf.getPage(pageNum);
        const canvas = await renderPageToCanvas(page, scale);
        
        pages.push(canvas);
        totalHeight += canvas.height;
        maxWidth = Math.max(maxWidth, canvas.width);
    }
    
    updateProgress(70, '正在合成长图...');
    
    // 创建长图canvas
    const longCanvas = document.createElement('canvas');
    longCanvas.width = maxWidth;
    longCanvas.height = totalHeight;
    const ctx = longCanvas.getContext('2d');
    
    // 设置白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, maxWidth, totalHeight);
    
    // 合成所有页面
    let currentY = 0;
    for (let i = 0; i < pages.length; i++) {
        updateProgress(70 + (i / pages.length) * 25, `正在合成第${i + 1}页...`);
        
        const canvas = pages[i];
        const x = (maxWidth - canvas.width) / 2; // 居中对齐
        ctx.drawImage(canvas, x, currentY);
        currentY += canvas.height;
    }
    
    updateProgress(95, '正在生成最终图片...');
    
    const pdfBaseName = getFileNameWithoutExtension(currentFile.name);
    const imageData = longCanvas.toDataURL(`image/${format}`, format === 'jpeg' ? 0.9 : undefined);
    convertedImages.push({
        data: imageData,
        name: `${pdfBaseName}_long_image.${format}`,
        canvas: longCanvas
    });
    
    updateProgress(100, '长图生成完成！');
}

// 渲染页面到Canvas
async function renderPageToCanvas(page, scale) {
    const viewport = page.getViewport({ scale: scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };
    
    await page.render(renderContext).promise;
    return canvas;
}

// 更新进度
function updateProgress(percentage, text) {
    progressFill.style.width = percentage + '%';
    progressText.textContent = text;
}

// 显示结果
function showResults() {
    // 隐藏进度，显示结果
    progressSection.style.display = 'none';
    resultSection.style.display = 'block';
    
    // 清空预览区域
    previewArea.innerHTML = '';
    
    // 显示预览图片
    convertedImages.forEach((image, index) => {
        const img = document.createElement('img');
        img.src = image.data;
        img.className = 'preview-image';
        img.alt = `转换结果 ${index + 1}`;
        previewArea.appendChild(img);
    });
    
    // 重置转换按钮
    resetConversionState();
    
    // 滚动到结果区域
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// 重置转换状态
function resetConversionState() {
    convertBtn.disabled = false;
    convertBtn.textContent = '开始转换';
}

// 下载图片
function downloadImages() {
    if (convertedImages.length === 0) {
        alert('没有可下载的图片！');
        return;
    }
    
    if (convertedImages.length === 1) {
        // 单个文件直接下载
        const image = convertedImages[0];
        downloadSingleImage(image.data, image.name);
    } else {
        // 多个文件打包下载
        downloadMultipleImages();
    }
}

// 下载单个图片
function downloadSingleImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 下载多个图片（简化版本，逐个下载）
function downloadMultipleImages() {
    convertedImages.forEach((image, index) => {
        setTimeout(() => {
            downloadSingleImage(image.data, image.name);
        }, index * 200); // 间隔200ms下载，避免浏览器阻止
    });
}

// 重置应用
function resetApplication() {
    // 重置变量
    currentPDF = null;
    convertedImages = [];
    currentFile = null;
    
    // 重置文件输入
    fileInput.value = '';
    
    // 重置上传区域
    const uploadContent = uploadArea.querySelector('.upload-content');
    uploadContent.innerHTML = `
        <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7,10 12,15 17,10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <h3>点击或拖拽上传PDF文件</h3>
        <p>支持的文件格式：PDF</p>
        <p>最大文件大小：50MB</p>
    `;
    
    // 隐藏其他区域
    settingsSection.style.display = 'none';
    progressSection.style.display = 'none';
    resultSection.style.display = 'none';
    
    // 重置转换按钮状态
    resetConversionState();
    
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
