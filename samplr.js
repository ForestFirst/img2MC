function onFileSelected(input) {

    var file = input.files[0];
    var reader = new FileReader();
    reader.onload = onFileLoaded;
    reader.readAsDataURL(file);
}

function onFileLoaded(e) {

    var src_data = e.target.result;
    var img = new Image();
    img.onload = onImageSetted;
    img.src = src_data;
}

function onImageSetted(e) {

    var img_data = createImageData(e.target);
    document.getElementById('test_canvas').width = img_data.width;
    document.getElementById('test_canvas').height = img_data.height;
    document.getElementById('test_canvas').getContext('2d').putImageData(img_data, 0, 0);
    document.getElementById('test_canvas').img_data = img_data;
    //document.getElementById('test_canvas').addEventListener('click', processImageData);
}

function createImageData(img) {

    var cv = document.createElement('canvas');

    cv.width = img.naturalWidth;
    cv.height = img.naturalHeight;

    var ct = cv.getContext('2d');

    ct.drawImage(img, 0, 0);

    var data = ct.getImageData(0, 0, cv.width, cv.height);

    return data;

}

function processImageData(num) {
    var cv = document.getElementById('test_canvas');
    var img_data = cv.img_data;
    
    //画像が選択されてるか確認
    if (!img_data) alert("画像が選択されてないよ！");

    let zip = init_zip();

    //左上のブロック設置座標
    let origin_xyz = [0,0,0];

    let processed_data = cv.getContext('2d').createImageData(img_data.width, img_data.height);
    //色格納
    let imagecolors = new Array(img_data.width * img_data.height * 4);

    if(num == 0){
        //誤差拡散法
        processed_data = greyErrorDiffusion(img_data,imagecolors,processed_data,origin_xyz,zip[0],zip[1]);
    }
    else if(num == 1){
        processed_data = colorErrorDiffusion(img_data,imagecolors,processed_data,origin_xyz,zip[0],zip[1]);
    }
    cv.getContext('2d').putImageData(processed_data, 0, 0);
}

/*
rgbからhsv変換
*/
function rgb2hsv(rgb,array_size){
    let r,g,b;
    let h,s,v;
    h = s = v = 0;
    let hsvS = new Array(array_size);
    for(var i = 0;i < rgb.length;i = i + 4){

        hsvS[i / 4] = [0,0,0];
        let Vmax,Vmin;

        r = rgb[i] / 255;
        g = rgb[i + 1] / 255;
        b = rgb[i + 2] / 255;

        Vmax = Math.max(r,g,b);
        Vmin = Math.min(r,g,b);

        v = Vmax * 100;
        s = (Vmax - Vmin) / Vmax * 100;
        //sが０ならhも０
        if(s == 0){
            if(r == Vmax) h = (g - b) / (Vmax - Vmin) * (Math.PI/3);
            else if(g == Vmax) h = (b - r) / (Vmax - Vmin) * (Math.PI/3) + 2 * Math.PI / 3;
            else if(b == Vmax) h = (r - g) / (Vmax - Vmin) * (Math.PI/3) + 4 * Math.PI / 3;
        }
        //Hを0~2πの間に収める
        if(h < 0) h = (h + 2 * Math.PI)/(2 * Math.PI) * 360;
        else if(h > 2 * Math.PI) h = (h - 2 * Math.PI)/(2 * Math.PI) * 360;

        hsvS[i / 4][0] = h;
        hsvS[i / 4][1] = s;
        hsvS[i / 4][2] = v;
    }        
    return hsvS;
}

/*
グレースケール化
*/
function rgb2grey(img_data,imagecolors){
    for (var y = 1;y < img_data.height;y++) {
        for (var x = 1;x < img_data.width;x++) {
            var index = (x + y * img_data.width)*4;
            rgb_grey = 0.2126 * img_data.data[index] + 0.7152 * img_data.data[index + 1] + 0.0722 * img_data.data[index + 2];    
            //rgb_grey = (img_data.data[index] + img_data.data[index + 1] + img_data.data[index + 2])/3;
            for(i = 0;i < 3;i++){
                imagecolors[index + i] = rgb_grey;
            }
            imagecolors[index + 3] = 255;
        }
    }
    return imagecolors;
}

/*
色格納
*/
function rgbInArray(img_data,imagecolors){
    for (var y = 1;y < img_data.height;y++) {
        for (var x = 1;x < img_data.width;x++) {
            var index = (x + y * img_data.width)*4;
            for(i = 0;i < 3;i++){
                imagecolors[index + i] = img_data.data[index + i];
                
            }
            imagecolors[index + 3] = 255;
        }
    }
    return imagecolors;
}

/*
hsv比較
*/
function compareHSV(hsv){
    //hsv[]
}

/*
excelファイル読み込み
csv_array[i][0] = {h,s,v}
csv_array[i][1] = {r,g,b}
*/
function loadCSVFile(angle){
    let csv = new XMLHttpRequest();
    var csv_array = [...Array(2)].map(k=>[...Array(360)].map(k=>[...Array(3)].map(k=>-1)))

    let rgb_array = new Array(3);
    let hsv_array = new Array(3);
    let tmp_array = [];
    
    csv.open("get", "./BlocksColor.csv",true);
    csv.send(null);
    
    csv.onload = function(){
        //格納
        tmp_array = (csv.responseText).split("\n");
        for(var i = 1;i < tmp_array.length - 1;i++){
            hsv_array = tmp_array[i].split(',').slice(7,10);
            rgb_array = tmp_array[i].split(',').slice(1,4);
            csv_array[0][hsv_array[0]] = [parseInt(hsv_array[0]),parseInt(hsv_array[1]),parseInt(hsv_array[2])];
            csv_array[1][hsv_array[0]] = [parseInt(rgb_array[0]),parseInt(rgb_array[1]),parseInt(rgb_array[2])];
        }
    }
    return csv_array;
}

/*
誤差拡散法（グレースケールver完成）
*/
function greyErrorDiffusion(img_data,imagecolors,processed_data,origin_xyz,zip,folder){

    //グレースケール化
    imagecolors = rgb2grey(img_data,imagecolors);

    var error;
    for (var y = 0;y < img_data.height - 1;y++) {
        for (var x = 0;x < img_data.width - 1;x++) {
            var mid_set_color = new Array(256);
            var error_add = new Array(256);
            for(var i = 0;i < 128;i++){
                mid_set_color [i] = 0;
                error_add[i] = 0;
            }
            for(var i = 128;i <= 255;i++){
                mid_set_color [i] = 255;
                error_add[i] = 255;
            }

            var index = (x + y * img_data.width)*4;
            //誤差計算
            error = imagecolors[index] - error_add[Math.round(imagecolors[index])];
            for(var i = 0;i < 3; i++){
                imagecolors[index + i] = mid_set_color[Math.round(imagecolors[index + i])];             
            }

            //拡散(7 5 3 1 を試したがノイズが大きい)
            for(var i = 0;i < 3; i++){
                //右
                if(x < img_data.width - 1){
                    imagecolors[((x + 1) + y * img_data.width)*4 + i] += (error * 5) / 16 | 0;                        
                }
                //左下
                if(x > 0){
                    imagecolors[((x - 1) + (y + 1) * img_data.width)*4 + i] += (error * 2.8) / 16 | 0;
                }
                //下
                if(i < img_data.height -1){
                    imagecolors[(x + (y + 1) * img_data.width)*4 + i] += (error * 5) / 16 | 0;
                }
                //右下
                if(x < img_data.width - 1 && y > img_data.height - 1){
                    imagecolors[((x + 1) + (y + 1) * img_data.width)*4 + i] += (error * 3.2) / 16 | 0;
                }
            }
        }
    }
    //画像化
    for (var i = 0;i < img_data.data.length;i++) {
        processed_data.data[i] = imagecolors[i];
    }
    
    //マイクラドット絵コマンド書き込み(ゲーム内のコマンド/functionで実行)
    let tmp_num;
    let count = 0;
    let filecount = 0;
    var functionStr = '';
    for (var y = 0;y < img_data.height;y++) {
        for (var x = 0;x < img_data.width;x++) {
            count++;
            var index = (x + y * img_data.width)*4;
            
            tmp_num = 0;
            for(var c = 1;c < img_data.width;c++) {
                if(imagecolors[((x + c) + y * img_data.width)*4] == imagecolors[index] && (x + c) <= img_data.width) {
                    tmp_num += 1;
                }
                else break;
            }

            if(imagecolors[index] == 0){
                functionStr += "fill " + (x + origin_xyz[0]) + " " + origin_xyz[1] + " " +  (y + origin_xyz[2]) + " " + (x + origin_xyz[0] + c) + " " + origin_xyz[1] + " " +  (y + origin_xyz[2]) + " minecraft:black_wool\n";
            }
            else if(imagecolors[index] == 255){
                functionStr += "fill " + (x + origin_xyz[0]) + " " + origin_xyz[1] + " " +  (y + origin_xyz[2]) + " " + (x + origin_xyz[0] + c) + " " + origin_xyz[1] + " " +  (y + origin_xyz[2]) + " minecraft:white_wool\n";
            }
            x += tmp_num;
            if(count >= 10000){
                filecount++;
                filesave(functionStr,filecount,folder);
                functionStr = "";
                count = 0;
            }
        }
    }
    filesave(functionStr,filecount,folder);
    zipDL(zip);

    return processed_data;
}

function colorErrorDiffusion(img_data,imagecolors,processed_data,origin_xyz,zip,folder){

    const angle = 360;
    const scope = 60;
    const h_mag = 2;

    let color_csv = loadCSVFile(angle);
    let width = img_data.width;
    let height = img_data.height;

    //色格納
    imagecolors = rgbInArray(img_data,imagecolors);

    //配列初期化
    var hsvS = new Array(width * height);
    for(let i = 0;i < hsvS.length;i++){
        hsvS[i] = new Array(3);
    }
    hsvS = rgb2hsv(imagecolors, width * height);

    //色比較
    for(var y = 0;y < height;y++){
        for(var x = 0;x < width;x++){
            let index = (x + y * width) * 4;
            let comp_value = new Array(scope);
            let min_angle;
            let max_angle;
            //比較範囲計算
            min_angle = hsvS[index / 4][0] - (scope / 2);
            if(min_angle < 0) min_angle += angle;
            max_angle = hsvS[index / 4][0] + (scope / 2);
            if(max_angle >= angle) max_angle -= angle;

            //比較
            var i = 0;
            let comp_hsvH = min_angle;
            while(i <= scope){
                comp_value[i] = 0;
                console.
                if(color_csv[0][comp_hsvH][0] != -1){
                    comp_value[i] = Math.abs(hsvS[index / 4][0] - color_csv[0][comp_hsvH][1]) * h_mag 
                    + Math.abs(hsvS[index / 4][1] - color_csv[0][comp_hsvH][1])
                    + Math.abs(hsvS[index / 4][2] - color_csv[0][comp_hsvH][2]);
                }
                comp_hsvH += i;
                if(comp_hsvH == angle) comp_hsvH = 0;
            }

            let tmp_comp_num = comp_value[0];
            var comp_num = min_angle;
            for(var i = 1;i < scope;i++){
                if(tmp_comp_num > comp_value[i]){
                    tmp_comp_num = comp_value[i];
                    comp_num = i + min_angle;
                }
            }

            //誤差（rgbそれぞれで算出）
            let error = [];
            for(var i = 0;i < 3;i++){
                error[i] = Math.abs(imagecolors[comp_num * 4 + i] - color_csv[1][comp_num][i]);
            }

            //誤差拡散
            for(var i = 0;i < 3; i++){
                //右
                if(x < width - 1){
                    imagecolors[((x + 1) + y * width)*4 + i] += (error[i] * 5) / 16 | 0;                        
                }
                //左下
                if(x > 0){
                    imagecolors[((x - 1) + (y + 1) * width)*4 + i] += (error[i] * 2.8) / 16 | 0;
                }
                //下
                if(i < height -1){
                    imagecolors[(x + (y + 1) * width)*4 + i] += (error[i] * 5) / 16 | 0;
                }
                //右下
                if(x < width - 1 && y > height - 1){
                    imagecolors[((x + 1) + (y + 1) * width)*4 + i] += (error[i] * 3.2) / 16 | 0;
                }
            }

            //rgb代入
            for(var i = 0;i < 3;i++){
                imagecolors[index + i] = color_csv[1][comp_num][i];
            }
            imagecolors[index + 3] = 255;
        }
        console.log((y + 1) + "列目終了");
    }

    //画像化
    for(var i = 0;i < img_data.data.length;i++) {
        processed_data.data[i] = imagecolors[i];
    }
    return processed_data;
}

async function filesave(str,filecount,folder){
    let blob = new Blob([str],{type:"text/plain"});
    folder.file("imagefill" + filecount + ".mcfunction",str);
}

function init_zip(){

    //zipファイル
    let zip = new JSZip();
    let folder1 = zip.folder("img2MC");
    let folder2 = folder1.folder("data");
    let pack_file = folder1.file('pack.mcmeta','{\n"pack": {\n"pack_format": 1,\n"description": "datapack"\n}\n}');
    let folder3 = folder2.folder("cheese");
    let folder4 = folder3.folder("functions");
    return [zip,folder4];
}

async function zipDL(zip){
    let img_element = document.getElementById('inputImage');

    zip.generateAsync({type:"blob"})
    .then(function(content) {
    saveAs(content, "img2MC.zip");
    console.log(img_element.name);
    });
}
