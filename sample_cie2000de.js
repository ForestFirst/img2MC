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
    let imagecolors = [...Array(img_data.width * img_data.height * 4)].map(k=>0);

    if(num == 0){
        //誤差拡散法
        processed_data = greyErrorDiffusion(img_data,imagecolors,processed_data,origin_xyz,zip[0],zip[1]);
    }
    else if(num == 1){
        processed_data = colorErrorDiffusion(img_data,processed_data,origin_xyz,zip[0],zip[1]);
    }
    else if(num == 2){
        processed_data = colorReplaceCiede2000(img_data,processed_data,origin_xyz,zip[0],zip[1]);
    }
    cv.getContext('2d').putImageData(processed_data, 0, 0);
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

function colorReplaceCiede2000(img_data,processed_data,origin_xyz,zip,folder){
    const angle = 360;
    const width = img_data.width;
    const height = img_data.height;  

    const color_csv = loadCSVFile();//csvファイル 

    for(var i = 0;i < width * height * 4;i += 4){
        let distance = [...Array()].map(k => 100.0);
        for(var j = 0;j < angle;j++){
            if(color_csv > -1 && output_data[i + 3] > 0){
                let lab = rgb2lab([output_data[index],output_data[index + 1],output_data[index + 2]]);
                distance[i] = ciede2000(lab[0],lab[1],lab[2],color_csv[2][i][0],color_csv[2][i][1],color_csv[2][i][2]);
            }   
        }
        //距離比較
        let tmp_comp_num = distance[0];
        let comp_num = 0;
        for(var i = 1;i < angle;i++){
            if(tmp_comp_num > distance[i]){
                tmp_comp_num = distance[i];
                comp_num = i;
            }
        }
        //置き換え
        for(var i = 0;i < 3; i++){
            //誤差（rgbそれぞれで算出）
            output_data[index + i] = color_csv[1][comp_num][i];
        }
    }
    //画像化 
    for (var i = 0;i < img_data.data.length;i++) { 
        processed_data.data[i] = output_data[i];
    }
    return processed_data;
}

function colorErrorDiffusion(img_data,processed_data,origin_xyz,zip,folder){

    const angle = 360;
    const width = img_data.width;
    const height = img_data.height;    
    const color_csv = loadCSVFile();//csvファイル
    let output_data = [...img_data.data];//画像の色コピー

    //色比較
    for(var y = 0;y < height;y++){
        for(var x = 0;x < width;x++){
            const index = (x + y * width) * 4;
            let distance = [...Array(angle)].map(k=>100.0);
            //比較
            for(var i = 0;i < angle; i++){
                if(color_csv[2][i][0] > -1 && output_data[index + 3] > 0){
                    let lab = rgb2lab([output_data[index],output_data[index + 1],output_data[index + 2]]);
                    distance[i] = ciede2000(lab[0],lab[1],lab[2],color_csv[2][i][0],color_csv[2][i][1],color_csv[2][i][2]);
                }
            }

            let tmp_comp_num = distance[0];
            let comp_num = 0;
            for(var i = 1;i < angle;i++){
                if(tmp_comp_num > distance[i]){
                    //console.log(comp_num,"g");
                    tmp_comp_num = distance[i];
                    comp_num = i;
                }
            }

            //一番近い色に置き換え
            let error = [...Array(3)].map(k => 0);
            for(var i = 0;i < 3; i++){
                //誤差（rgbそれぞれで算出）
                error[i] = output_data[index + i] - color_csv[1][comp_num][i];
                output_data[index + i] = color_csv[1][comp_num][i];
            }

            //誤差拡散
            let indexR = ((x + 1) + y * width)*4;
            let indexUL = ((x - 1) + (y + 1) * width)*4;
            let indexU = (x + (y + 1) * width)*4;
            let indexUR = ((x + 1) + (y + 1) * width)*4;
            for(var i = 0;i < 3; i++){
                //右
                if(x < width - 1){
                    output_data[indexR + i] = normalizeOutput(output_data[indexR + i] + (error[i] * 5) / 16);  
                }
                //左下
                if(x > 0){
                    output_data[indexUL + i] = normalizeOutput(output_data[indexUL + i] + (error[i] * 2.8) / 16);
                }
                //下
                if(y < height -1){
                    output_data[indexU + i] = normalizeOutput(output_data[indexU + i] + (error[i] * 5) / 16);
                }
                //右下
                if(x < width - 1 && y > height - 1){
                    output_data[indexUR + i] = normalizeOutput(output_data[indexUR + i] + (error[i] * 3.2) / 16);
                }
            }
        }
    }

    //画像化 
    for (var i = 0;i < img_data.data.length;i++) { 
        processed_data.data[i] = output_data[i];
    }
    return processed_data;
}
/*
アウトプットカラー正規化
*/
function normalizeOutput(color){
    if(color > 255) color = 255;
    else if(color < 0) color = 0;
    return color;
}

/*
minAngle計算
*/
function minAngleCalculate(hsvS,scope,angle){
    let min_angle;
    min_angle = hsvS - (scope / 2);
    if(min_angle < 0) min_angle += angle;
    return min_angle;
}

/*
maxAngle計算
*/
function maxAngleCalculate(hsvS,scope,angle){
    let max_angle;
    max_angle = hsvS + (scope / 2);
    if(max_angle >= 360) max_angle -= angle;
    return max_angle;
}
/*
0 ~ 359に正規化
*/
function angleSet(num,angle){
    if(num >= 360) num -= angle;
    if(num < 0) num += angle;
    return num;
}
function init_rgb2lab(array,array_size){
    let labS = [...Array(array_size)].map(k=>[...Array(3)].map(k=>-1));
    for(var i = 0;i < array_size * 4;i += 4){
        labS[i / 4] = rgb2lab([array[i],array[i + 1],array[i + 2]]).map(x => Math.round(x));
    }
    return labS;
}
/*
rgbからlabに変換
*/
function rgb2lab(rgb) {
    r = rgb[0];
    g = rgb[1];
    b = rgb[2];

    r = r > 0.04045 ? Math.pow(((r/ 255 + 0.055) / 1.055), 2.4) : (r / 12.92);
    g = g > 0.04045 ? Math.pow(((g/ 255 + 0.055) / 1.055), 2.4) : (g / 12.92);
    b = b > 0.04045 ? Math.pow(((b/ 255 + 0.055) / 1.055), 2.4) : (b / 12.92);

    var x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
    var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
    var z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

    var L;
    var a;
    var b;

    x /= 0.9595;
    y /= 1;
    z /= 1.0890;

    x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (4 / 29);
    y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (4 / 29);
    z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (4 / 29);
    L = (116 * y) - 16;
    a = 500 * (x - y);
    b = 200 * (y - z);
    //場合分けなしver
    /*
    L = 100 * y ** (1/2.44);
    a = 435.8 * Math.pow(x,0.40984) - Math.pow(y,0.40984);
    b = 173.6 * Math.pow(y,0.40984) - Math.pow(z,0.40984);
    */

    return [L, a, b];
}

/*
rgbからhsv変換
*/
function rgb2hsv(rgb,array_size){
    let r,g,b;
    let h,s,v;
    let hsvS = [...Array(array_size)].map(k=>[...Array(3)].map(k=>-1));
    for(var i = 0;i < rgb.length;i = i + 4){
        let Vmax,Vmin;

        if(rgb[i] == undefined) r = 0;
        else r = rgb[i] / 255;
        if(rgb[i + 1] == undefined) g = 0
        else g = rgb[i + 1] / 255;
        if(rgb[i + 2] == undefined) b = 0;
        else b = rgb[i + 2] / 255;
        
        Vmax = Math.max(r,g,b);
        Vmin = Math.min(r,g,b);

        if(Vmax == 0) v = 0;
        else v = Vmax * 100;

        if((Vmax - Vmin) == 0) s = 0;
        else s = (Vmax - Vmin) / Vmax * 100;
        //sが０ならhも０
        if(s == 0) h = 0;
        else {
            if(r == Vmax) h = (g - b) / (Vmax - Vmin) * (Math.PI/3);
            else if(g == Vmax) h = (b - r) / (Vmax - Vmin) * (Math.PI/3) + 2 * Math.PI / 3;
            else if(b == Vmax) h = (r - g) / (Vmax - Vmin) * (Math.PI/3) + 4 * Math.PI / 3;
        }
        //Hを0~2πの間に収める
        if(h < 0) h += 2 * Math.PI;
        else if(h > 2 * Math.PI) h -= 2 * Math.PI;
        h = h / (2 * Math.PI) * 360;

        hsvS[i / 4][0] = Math.round(h);
        hsvS[i / 4][1] = Math.round(s);
        hsvS[i / 4][2] = Math.round(v);
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
function rgbInArray(img_data){
    let color_data = [];//[...Array(img_data.width * img_data.height * 4)].map(k=>0);
    for(var i = 0;i < img_data.width * img_data.height * 4;i += 4){
        for(var j = 0;j < 3;j++){
            color_data[i + j] = img_data.data[i + j];
        }
        color_data[i + 3] = 255;
    }
    return color_data;
}

/*
hsv比較
*/
function ciede2000(L1,a1,b1, L2,a2,b2, kL=1,kC=1,kH=1) {
    //http://en.wikipedia.org/wiki/Color_difference#CIEDE2000
    var radianToDegree = function(radian) {return radian * (180 / Math.PI);};
    var degreeToRadian = function(degree) {return degree * (Math.PI / 180);};

    var deltaLp = L2 - L1;
    var L_ = (L1 + L2) / 2;
    var C1 = Math.sqrt(Math.pow(a1, 2) + Math.pow(b1, 2));
    var C2 = Math.sqrt(Math.pow(a2, 2) + Math.pow(b2, 2));
    var C_ = (C1 + C2) / 2;
    var ap1 = a1 + (a1 / 2) *
        (1 - Math.sqrt(
            Math.pow(C_, 7) /
            (Math.pow(C_, 7) + Math.pow(25, 7))
            )
        );
    var ap2 = a2 + (a2 / 2) *
        (1 - Math.sqrt(
            Math.pow(C_, 7) /
            (Math.pow(C_, 7) + Math.pow(25, 7))
            )
        );
    var Cp1 = Math.sqrt(Math.pow(ap1, 2) + Math.pow(b1, 2));
    var Cp2 = Math.sqrt(Math.pow(ap2, 2) + Math.pow(b2, 2));
    var Cp_ = (Cp1 + Cp2) / 2;
    var deltaCp = Cp2 - Cp1;

    var hp1;
    if (b1 == 0 && ap1 == 0) {
        hp1 = 0;
    } else {
        hp1 = radianToDegree(Math.atan2(b1, ap1));
        if (hp1 < 0) {hp1 = hp1 + 360;}
    }
    var hp2;
    if (b2 == 0 && ap2 == 0) {
        hp2 = 0;
    } else {
        hp2 = radianToDegree(Math.atan2(b2, ap2));
        if (hp2 < 0) {hp2 = hp2 + 360;}
    }

    var deltahp;
    if (C1 == 0 || C2 == 0) {
        deltahp = 0;
    } else if (Math.abs(hp1 - hp2) <= 180) {
        deltahp = hp2 - hp1;
    } else if (hp2 <= hp1) {
        deltahp = hp2 - hp1 + 360;
    } else {
        deltahp = hp2 - hp1 - 360;
    }

    var deltaHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(degreeToRadian(deltahp) / 2);

    var Hp_;
    if (Math.abs(hp1 - hp2) > 180) {
        Hp_ =  (hp1 + hp2 + 360) / 2
    } else {
        Hp_ = (hp1 + hp2) / 2
    };

    var T = 1 -
        0.17 * Math.cos(degreeToRadian(Hp_ - 30)) +
        0.24 * Math.cos(degreeToRadian(2 * Hp_)) +
        0.32 * Math.cos(degreeToRadian(3 * Hp_ + 6)) -
        0.20 * Math.cos(degreeToRadian(4 * Hp_ - 63));

    var SL = 1 + (
        (0.015 * Math.pow(L_ - 50, 2)) /
        Math.sqrt(20 + Math.pow(L_ - 50, 2))
        );
    var SC = 1 + 0.045 * Cp_;
    var SH = 1 + 0.015 * Cp_ * T;

    var RT = -2 *
        Math.sqrt(
            Math.pow(Cp_, 7) /
            (Math.pow(Cp_, 7) + Math.pow(25, 7))
        ) *
        Math.sin(degreeToRadian(
            60 * Math.exp(-Math.pow((Hp_ - 275) / 25, 2))
        ));

    return Math.sqrt(
        Math.pow(deltaLp / (kL * SL), 2) +
        Math.pow(deltaCp / (kC * SC), 2) +
        Math.pow(deltaHp / (kH * SH), 2) +
        RT * (deltaCp / (kC * SC)) * (deltaHp / (kH * SH))
        );
}


/*
excelファイル読み込み
csv_array[i][0] = {h,s,v}
csv_array[i][1] = {r,g,b}
*/
function loadCSVFile(){
    let csv = new XMLHttpRequest();
    let array = [...Array(3)].map(k=>[...Array(360)].map(k=>[...Array(3)].map(k=>-1)));
    csv.open("get", "BlocksColor.csv",false);
    csv.send(null);
    /*
    csv.onload = function(e){
        if (csv.readyState === 4){
            if(csv.status === 200){
                console.log("ブロック色のファイルは読み込めました。");

                let str = csv.responseText;
                let tmp_array = str.split("\n");
                for(var i = 1;i < tmp_array.length - 1;i++){
                    let hsv_array = Array.from(tmp_array[i].split(',').slice(7,10), str => parseInt(str, 10));
                    console.log(hsv_array,isNaN(hsv_array));
                    let rgb_array = Array.from(tmp_array[i].split(',').slice(1,4), str => parseInt(str, 10));
                    console.log(rgb_array,isNaN(rgb_array));
                    array[0][hsv_array[0]] = hsv_array.map(k => ({...hsv_array}));
                    //array[0][hsv_array[0]] = [parseInt(hsv_array[0]),parseInt(hsv_array[1]),parseInt(hsv_array[2])];
                    array[1][rgb_array[0]] = rgb_array.map(k => ({...rgb_array}));;
                    //array[1][rgb_array[0]] = [parseInt(rgb_array[0]),parseInt(rgb_array[1]),parseInt(rgb_array[2])];
                }
                

            }else{
                console.error(csv.statusText);
            }
        }
    }
    */
    console.log("ブロック色のファイルは読み込めました。");

    let str = csv.responseText;
    let tmp_array = str.split("\n");
    for(var i = 1;i < tmp_array.length - 1;i++){
        let hsv_array = Array.from(tmp_array[i].split(',').slice(7,10), str => parseInt(str, 10));
        let rgb_array = Array.from(tmp_array[i].split(',').slice(1,4), str => parseInt(str, 10));
        array[0][hsv_array[0]] = hsv_array;
        //array[0][hsv_array[0]] = [parseInt(hsv_array[0]),parseInt(hsv_array[1]),parseInt(hsv_array[2])];
        array[1][hsv_array[0]] = rgb_array;
        //array[1][rgb_array[0]] = [parseInt(rgb_array[0]),parseInt(rgb_array[1]),parseInt(rgb_array[2])];
        array[2][hsv_array[0]] = rgb2lab(rgb_array).map(x => Math.round(x));
    }
    
    return array;
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

