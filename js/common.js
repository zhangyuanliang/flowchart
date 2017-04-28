var loadDialogIndex;
//备份jquery的ajax方法  
var _ajax = $.ajax;

//日期选择清空
$("#loadContent").on("click",".form_datetime",function(){
	$(this).val() && $(this).val("");
})

//重写jquery的ajax方法  
$.ajax = function(opt){ 
	//备份opt中error和success方法  
	//增加了shade属性，用来区分是否显示加载层，1为需要显示；2为不需要显示；默认为1
	var _option = {  
		error: function(XMLHttpRequest, textStatus, errorThrown){},  
		success: function(data, textStatus){},
		beforeSend: function(){},
		shade: 1
	}  
	if(opt.error){  
		_option.error = opt.error;  
	}  
	if(opt.success){  
		_option.success = opt.success;  
	}
	if(opt.beforeSend){
		_option.beforeSend = opt.beforeSend;
	}
	if(opt.shade){
		_option.shade = opt.shade;
	}

	//扩展增强处理  
	var _opt = $.extend(opt, {  
		beforeSend: function(xhr, s){
			if(_option.shade == 1){
				loadDialogIndex = layer.load(1, {shade:[0.3, '#000']});
			}
			_option.beforeSend(xhr, s);
		},
		error: function(XMLHttpRequest, textStatus, errorThrown){  

			//错误方法增强处理  
			if(_option.shade == 1){
				layer.close(loadDialogIndex);
			}
			//正上方
			layer.msg('处理出错了。。。', {
				offset: 0,
				shift: 6
			});
			console.log("XMLHttpRequest:" + JSON.stringify(XMLHttpRequest));
			console.log("textStatus:" + JSON.stringify(textStatus));
			console.log("errorThrown:" + JSON.stringify(errorThrown));
			_option.error(XMLHttpRequest, textStatus, errorThrown);  
		},  
		success: function(data){
			if(_option.shade == 1){
				layer.close(loadDialogIndex);
			}
			if(data.code == 2){
				//登陆超时 跳转页面
				//alert(loginPath);
				$.cookie('indexBodyfalg','1');
				location.href=loginPath;
			}
			if(typeof data =="object" && !data.success){
				var msgvar = data.msg?data.msg:data.values.message;
				layer.msg(msgvar, {
					offset: 0,
					shift: 6
				});
				return false;
			}
			_option.success(data);  
		}  
	});  
	return _ajax(_opt);  
};  

/**
 * jquery扩展函数
 */
$.fn.extend({
	/**
	 * 模板引擎使用
	 * @param tmpl 模板html
	 * @param data 数据
	 * @param callback 回调函数
	 */
	tmpl : function(tmpl, data, callback){
		var $this = $(this);
		$.tmpl(tmpl, data, function(render){
			$this.html(render);
			if(callback){
				callback(render);
			}
		});
	},
	outerHTML : function() {
		$this = $(this);
		var h = $this.html();
		var s = $this.wrap("<div></div>").parent().html();
		$this.empty().html(h);
		return s;
	},
	trimForm: function(){
		$(this).find("input, textarea").each(function(){
			$(this).val($.trim($(this).val())); 
		});
		return $(this);
	}
});

/**
 * jquery函数扩展
 */
$.extend({
	/**
	 * 使用模板引擎渲染数据
	 * @param tmpl 需要渲染的模板html
	 * @param data 要渲染的数据
	 * @param callback 回调函数，返回渲染数据之后的html以便后续处理
	 */
	tmpl: function(tmpl, data, callback){
		laytpl(tmpl).render(data, function(render){
			if(callback){
				callback(render);
			}
		});
	},
	getjson: function(obj, key){
		if(!key || !obj){
			return "";
		}
		if(key.indexOf(".") < 0){
			return obj[key];
		} else{
			var keyArr = key.split(".");
			for(var i=0; i<keyArr.length; i++){
				obj = obj[keyArr[i]];
			}
			return obj;
		}
	},
	/**
	 * 显示分页信息
	 * @param options 自定义参数，规则与原始插件相同
	 * @param select 查询数据的js函数，参数有两个，依次是：当前页数，每页数量
	 * @param size 每页显示数量，默认为9条（为了兼容智家商城中纵向视图和横向视图的显示）
	 */
	pages: function(options, select, size){
		//每页数量默认为10条
		size = !size || size < 1 ? 10 : size;
		var pages = options.count % size == 0 ? options.count / size : Math.ceil(options.count/size);
		//默认的分页配置
		var settings = {
			cont : 'pageDiv', // 容器。值支持id名、原生dom对象，jquery对象。【如该容器为】：<div id="page1"></div>
			pages : pages, // 通过后台拿到的总页数
			curr : options.curr, // 初始化当前页
			skin: "own", //皮肤
			skip: true,//是否开启跳页
			jump : function(obj, first) { // 触发分页后的回调
				//添加总页数
				if(obj.count>size){
					$("#"+this.cont).append("<span class='pageCount'>共"+obj.count+"条</span>");
				}
				if(!first){
					select(obj.curr, size);
				}
			}	
		};
		//合并分页配置
		$.extend(settings, options);
		//显示分页
		laypage(settings);
	},
	//本地存储
	store: function(key, value){
		try {
			if (value == undefined) {
				return localStorage.getItem(key);
			} else {
				localStorage.setItem(key, value);
			}
		} catch (e) {
		}
	}
});
 /** * 对Date的扩展，将 Date 转化为指定格式的String * 月(M)、日(d)、12小时(h)、24小时(H)、分(m)、秒(s)、周(E)、季度(q)
 * 可以用 1-2 个占位符 * 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字) * eg: * (new
 * Date()).pattern("yyyy-MM-dd hh:mm:ss.S")==> 2006-07-02 08:09:04.423      
 * (new Date()).pattern("yyyy-MM-dd E HH:mm:ss") ==> 2009-03-10 二 20:09:04      
 * (new Date()).pattern("yyyy-MM-dd EE hh:mm:ss") ==> 2009-03-10 周二 08:09:04      
 * (new Date()).pattern("yyyy-MM-dd EEE hh:mm:ss") ==> 2009-03-10 星期二 08:09:04      
 * (new Date()).pattern("yyyy-M-d h:m:s.S") ==> 2006-7-2 8:9:4.18      
 */     
Date.prototype.pattern=function(fmt) {         
    var o = {         
    "M+" : this.getMonth()+1, //月份         
    "d+" : this.getDate(), //日         
    "h+" : this.getHours()%12 == 0 ? 12 : this.getHours()%12, //小时         
    "H+" : this.getHours(), //小时         
    "m+" : this.getMinutes(), //分         
    "s+" : this.getSeconds(), //秒         
    "q+" : Math.floor((this.getMonth()+3)/3), //季度         
    "S" : this.getMilliseconds() //毫秒         
    };         
    var week = {         
    "0" : "/u65e5",         
    "1" : "/u4e00",         
    "2" : "/u4e8c",         
    "3" : "/u4e09",         
    "4" : "/u56db",         
    "5" : "/u4e94",         
    "6" : "/u516d"        
    };         
    if(/(y+)/.test(fmt)){         
        fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));         
    }         
    if(/(E+)/.test(fmt)){         
        fmt=fmt.replace(RegExp.$1, ((RegExp.$1.length>1) ? (RegExp.$1.length>2 ? "/u661f/u671f" : "/u5468") : "")+week[this.getDay()+""]);         
    }         
    for(var k in o){         
        if(new RegExp("("+ k +")").test(fmt)){         
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));         
        }         
    }         
    return fmt;         
}       
// Extend the default Number object with a formatMoney() method:
// usage: someVar.formatMoney(decimalPlaces, symbol, thousandsSeparator, decimalSeparator)
// defaults: (2, "￥", ",", ".")
// var price = 4999.99;
// alert(price.formatMoney(2, "€", ".", ",")); // €4.999,99
Number.prototype.formatMoney = function (places, symbol, thousand, decimal) {
	places = !isNaN(places = Math.abs(places)) ? places : 2;
	symbol = symbol !== undefined ? symbol : "￥";
	thousand = thousand || ",";
	decimal = decimal || ".";
	var number = this,
		negative = number < 0 ? "-" : "",
		i = parseInt(number = Math.abs(+number || 0).toFixed(places), 10) + "",
		j = (j = i.length) > 3 ? j % 3 : 0;
	return symbol + negative + (j ? i.substr(0, j) + thousand : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousand) + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) : "");
};
//格式化数字
function cc(obj){
	if(obj){
		return obj.toFixed(2);
	}else{
		return "0.00";
	}
}
//格式化金额
function ccMoney(obj){
	if(obj){
		return obj.formatMoney();
	}else{
		return "￥ 0.00";
	}
}
// var aaa=123
// aaa.toFixed(3);//123.00
// 格式化 json
function json_obj(str){
	str=str.replace(new RegExp('(["\"])', 'g'),"\\\"");
	var pattern= new RegExp("'([\r\n])[\s]+'") ; //创建一个包含\n的正则对象
	var result="";  //定义一个空字符
	for(var i=0;i<str.length;i++){
		result=result+str.substr(i,1).replace(pattern,'');//逐字检索 发现\n就换为空;
	}

	return result; //返回转换完成的新json字符串
}

//加入收藏夹
function addFavorite(sURL, sTitle){
	try {
		window.external.addFavorite(sURL, sTitle);
	} catch (e) {
		try {
			window.sidebar.addPanel(sTitle, sURL, "");
		} catch (e) {
			layer.alert("加入收藏失败，请按Ctrl+D进行添加",{icon : 0});
		}
	}
}
function getRandom(n) {
	return Math.floor(Math.random() * n + 1)
}
function loadMenu(menuKeyWord){
	var option = {
			url:"/moss/web/myMenuList.x",
			type: "post",
			dataType: "json",
			async: false,
			success: function(data){
				if(data.success){
				showMenu(data.values.menuList,menuKeyWord);
				}else{
					layer.alert(data.values.message);
				}
			},
			error:function(XMLHttpRequest, textStatus, errorThrown) {
				layer.alert("服务器繁忙,请稍后再试...!");
			}
		};
	$.ajax(option);
}
/**
 * 根据json显示菜单
 */
function showMenu(menuJsonStr,menuKeyWord){
	var map=function (key,value){
		this.key=key
		this.value=value
	}
	//已经添加的元素集合
	var pushData=[];
	$.each(menuJsonStr,function(idx,menu){
		var menuli = "";
		//一级菜单
		if(menu.menuLevel == "1" &&menu.keyWord==menuKeyWord){		
			//判断是否是存在二级菜单
			if(menu.menuUrl.length==0){
				menuli = $("<li  id=parent_"+menu.id+"><a href='javascript:void(0);' ><i class='"+menu.menuImg+"'></i>&nbsp;"+menu.menuName+"<span class='sr-only'>(current)</span></a></li>");
				menuli.data("menuInfo",menu);
			}else{
				menuli = $("<li  id=parent_"+menu.id+"><a class='loadPageCss' date_href="+(httpStaticDomain+menu.menuUrl)+" ><i class='"+menu.menuImg+"'></i>&nbsp;"+menu.menuName+"<span class='sr-only'>(current)</span></a></li>");
				menuli.data("menuInfo",menu);
			}
			if($("#parent_"+menu.id).length==0){
				//排序菜单
				var flag=true;
				for(x in pushData){
					if(pushData[x].key > parseInt(menu.menuCode)){
						flag=false
						$("#parent_"+pushData[x].value).before(menuli)
						pushData.push(new map(parseInt(menu.menuCode), menu.id))
						break;
					}
				}
				if(flag){
					$("#menu").append(menuli);
					pushData.push(new map(parseInt(menu.menuCode),menu.id))
				}
			}
		}
	});

	$.each(menuJsonStr,function(idx,menu){
		var subMenu = "";
		//判断是否已经存在二级菜单根
		if(menu.menuLevel == "2" && menu.keyWord==menuKeyWord){
			if($('#'+menu.parentId).find('.sub-menu-list').length == 0 && $("#"+menu.parentId+"_ul").length == 0){
				menuUl = "<ul id='"+ menu.parentId+"_ul' class='sub-menu-list'></ul>";						
				$("#parent_"+menu.parentId).append(menuUl);
			}
			//增加二级菜单
			if($("child"+menu.id).length==0){
			var menuli = "<li><a class='loadPageCss' date_href="+(httpStaticDomain+menu.menuUrl)+" id='child"+menu.id+"'><i class='"+menu.menuImg+"'></i>&nbsp;"+menu.menuName+"</a></li>";	
			if($("#child"+menu.id).length==0){
			$("#"+menu.parentId+"_ul").append(menuli);
			}
			}
		}
	});

	$(".menu-list").each(function (){
		if($(this).find(".sub-menu-list").length==0){
			$(this).find("a").css("background","none");
		}
	})
	//点击菜单跳转页面方法
	$(".loadPageCss").on("click",function(){
		loadPage($(this).attr("date_href"));
	});
}
//退出
function logout(){

	layer.confirm('确定要退出吗？', function(index){
	layer.close(index);
		$.ajax({
			url: basePath + '/moss/web/logout.x',
			type: 'post',
			dataType: 'json',
			success: function(data){
				$.cookie('indexBodyfalg','1');
				location.href=loginPath;
			}
		});
	});
}

//取用户名
function loadUser() {
	var option = {
		url: "/moss/web/getSessionUser.x",
		type: "post",
		dataType: "json",
		async: true,
		success: function(data) {
			if(data.values.userInfo){
				var userInfo=data.values.userInfo.sessionUserInfo;
				if(userInfo!=null&userInfo!=""){
					var userName=data.values.userInfo.sessionUserInfo.account;
					if(userName!=null&userName!=""){
						$("#dropdownMenu1").html(userName);
						$("#welcomeUser").html(userName);
					}else{
						$("#dropdownMenu1").html(data.values.userInfo.sessionUserInfo.name);
						$("#welcomeUser").html(data.values.userInfo.sessionUserInfo.name);
					}
					//显示动画
					if(!$.cookie('the_moss_wow')){
						//wow动画
						var wow = new WOW({
								boxClass: 'wow',
								animateClass: 'animated',
								offset: 0,
								mobile: true,
								live: true
							});
						wow.init();
						$('.fullTips').show();
						//页面加载完毕3秒后执行关闭提示
						setTimeout(function(){
							$('.fullTips').addClass('bounceOutLeft');
						},3000);
						$.cookie('the_moss_wow', '1');
						
					}
					$(".coverBody").hide();
				}
			}
		},
		error: function(XMLHttpRequest, textStatus, errorThrown) {

		}
	};
	$.ajax(option);
}

//显示用户名
function displayUser() {
	var userName=data.values.userInfo.sessionUserInfo.account;
	if(userName!=null&userName!=""){
		$("#dropdownMenu1").html(userName);
		$("#welcomeUser").html(userName);
	}else{
		$("#dropdownMenu1").html(data.values.userInfo.sessionUserInfo.name);
		$("#welcomeUser").html(data.values.userInfo.sessionUserInfo.name);
	}
}
//logo跳转
$('.webLogo').on('click',function(){
	document.location.href=basePath;
})

$('li.escFather').mouseover(function() {   
		$(this).addClass('open');   
}).mouseout(function() {
	$(this).removeClass('open');
});

function loadPage(url){
	//右侧load页面
	$('#loadContent').load(url);	
}