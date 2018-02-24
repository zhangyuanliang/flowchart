/**
 * jquery函数扩展
 */
$.fn.extend({
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
	 * 显示分页信息
	 * @param options 自定义参数，规则与原始插件相同
	 * @param select 查询数据的js函数，参数有两个，依次是：当前页数，每页数量
	 * @param size 每页显示数量，默认为10条
	 */
	pages: function(options, select, size) {
		//每页数量默认为10条
		size = !size || size < 1 ? 10 : size;
		var pages = options.count % size == 0 ? options.count / size : Math.ceil(options.count/size);
		//默认的分页配置
		var settings = {
		    cont: 'pageDiv', // 容器。值支持id名、原生dom对象，jquery对象。【如该容器为】：<div id="pageDiv"></div>
		    pages: pages, // 通过后台拿到的总页数
		    skin: '#3B5998', // 加载内置皮肤，也可以直接赋值16进制颜色值，如:#c00
		    curr: options.curr, // 当前页
		    skip: true, // 是否开启跳页
		    groups: 3, // 连续显示分页数
		    jump: function(obj, first) {// 触发分页后的回调
				// 添加总页数
				if (obj.count > size) {
					$("#" + this.cont + '>div').append("<span class='pageCount'>共" + obj.count + "条</span>");
				}
				if (!first) {
					select(obj.curr, size);
				}
			}	
		};
		// 合并分页配置
		$.extend(settings, options);
		// 显示分页
		laypage(settings);
	}

});

 /**
 * 对Date的扩展，将 Date 转化为指定格式的String * 月(M)、日(d)、12小时(h)、24小时(H)、分(m)、秒(s)、周(E)、季度(q)
 * 可以用 1-2 个占位符 * 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字) * eg: * (new
 * Date()).pattern("yyyy-MM-dd hh:mm:ss.S")==> 2006-07-02 08:09:04.423      
 * (new Date()).pattern("yyyy-MM-dd E HH:mm:ss") ==> 2009-03-10 二 20:09:04      
 * (new Date()).pattern("yyyy-MM-dd EE hh:mm:ss") ==> 2009-03-10 周二 08:09:04      
 * (new Date()).pattern("yyyy-MM-dd EEE hh:mm:ss") ==> 2009-03-10 星期二 08:09:04      
 * (new Date()).pattern("yyyy-M-d h:m:s.S") ==> 2006-7-2 8:9:4.18      
 */     
Date.prototype.pattern = function(fmt) {         
    var o = {         
	    "M+" : this.getMonth() + 1, //月份         
	    "d+" : this.getDate(), //日         
	    "h+" : this.getHours() % 12 == 0 ? 12 : this.getHours() % 12, //小时         
	    "H+" : this.getHours(), //小时         
	    "m+" : this.getMinutes(), //分         
	    "s+" : this.getSeconds(), //秒         
	    "q+" : Math.floor((this.getMonth() + 3) / 3), //季度         
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
    if (/(y+)/.test(fmt)) {         
        fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));         
    }         
    if (/(E+)/.test(fmt)) {         
        fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length>2 ? "/u661f/u671f" : "/u5468") : "") + week[this.getDay()+""]);         
    }         
    for (var k in o) {         
        if (new RegExp("("+ k +")").test(fmt)) {         
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));         
        }         
    }         
    return fmt;         
};     

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
function cc(obj) {
	if (obj) {
		return obj.toFixed(2);
	} else {
		return "0.00";
	}
}

//格式化金额
function ccMoney(obj) {
	if (obj) {
		return obj.formatMoney();
	} else {
		return "￥ 0.00";
	}
}

// 格式化 json
// json_obj('{"name":"zhang","sex":"男"}');
// return '{\"name\":\"zhang\",\"sex\":\"男\"}' 
function json_obj(str) {
	str = str.replace(new RegExp('(["\"])', 'g'), "\\\"");
	var pattern = new RegExp("'([\r\n])[\s]+'") ; //创建一个包含\n的正则对象
	var result = "";  //定义一个空字符
	for(var i = 0;i < str.length; i++) {
		result = result + str.substr(i, 1).replace(pattern, '');//逐字检索 发现\n就换为空;
	}
	return result; //返回转换完成的新json字符串
}

//获取n以内的随机数
function getRandom(n) {
	return Math.floor(Math.random() * n + 1);
}

/** 
 * randomWord 产生任意长度随机字母数字组合
 * randomFlag-是否任意长度 min-任意长度最小位[固定位数] max-任意长度最大位
 * xuanfeng 2014-08-28
 */
function randomWord(randomFlag, min, max) {
    var str = "",
        range = min,
        arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 
        	   /*'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 
        	   'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 
        	   'u', 'v', 'w', 'x', 'y', 'z', */
        	   'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 
        	   'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 
        	   'U', 'V', 'W', 'X', 'Y', 'Z'];
    if (randomFlag) {
        range = Math.round(Math.random() * (max - min)) + min;
    }
    for (var i = 0; i < range; i++) {
        pos = Math.round(Math.random() * (arr.length - 1));
        str += arr[pos];
    }
    return str;
}

/**
 * [generateUUID 返回一串序列码]
 * @return {String} [uuid]
 */
function generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
}

/**
 * 生成不重复的序列号
 */
var serial_marker = function() {
	var prefix = '';
	var seq = 1;
	return {
	    set_prefix: function(p) {
	        prefix = String(p);
	    },
	    set_seq: function(s) {
	        seq = s;
	    },
	    gensym: function() {
	        var result = prefix + seq;
	        seq += 1;
	        return result;
	    }
	};
};

/**
 * 根据id从nodes中获取相应的node对象
 */
function getNodeById(id, nodes) {
	if (!nodes.length) return false;
	nodes.forEach(function(node) {
		if (node.id == id) {
			return node;
		}
	});
	return false;
}

//这一块的封装，主要是针对数字类型的数组
function maxArr(arr) {
    return Math.max.apply(null, arr);
}
function minArr(arr) {
    return Math.min.apply(null, arr);
}

var is_array = function(value) {
	return Object.prototype.toString.apply(value) === '[object Array]';
};

var is_number = function(value) {
	return typeof value === 'number' && isFinite(value);
};

/**
 * 存放所有 GraphCreator 对象及方法 
 */
var graphPool = {
	pools: [],
	updateGraphActiveById: function(containerId) {
	  this.pools.forEach(function(graph) {
	    if (graph.containerId === containerId) {
	      	graph.state.activeEdit = true;
	    } else {
	      	graph.state.activeEdit = false;
	    }
	  });
	},
	getGraphByActiveEdit: function() {
	  	var graph_active = this.pools.find(function(graph) {
	    	return graph.state.activeEdit;
	  	});
	  	return graph_active;
	},
	removeGraphFromPools: function(containerId) {
		var pools = this.pools;
		for (var i = 0; i < pools.length; i++) {
			if (pools[i].containerId === containerId) {
				pools.splice(i, 1);
			}
		}

	}
};

/**
 * 大小写字母转化
 * @param  {[type]} str  需要转化的字符串	
 * @param  {[type]} type 1: 首字母大写 2：首页母小写 3：大小写转换 4：全部大写 5：全部小写
 * @return {[type]}      转化后的字符串
 * changeCase('asdasd', 1) --> Asdasd
 */
function changeCase(str, type) {
	if (!str) return '';
    function ToggleCase(str) {
        var itemText = "";
        str.split("").forEach(
            function (item) {
                if (/^([a-z]+)/.test(item)) {
                    itemText += item.toUpperCase();
                }
                else if (/^([A-Z]+)/.test(item)) {
                    itemText += item.toLowerCase();
                }
                else{
                    itemText += item;
                }
            });
        return itemText;
    }
    switch (type) {
        case 1:
            return str.replace(/^(\w)(\w+)/, function (v, v1, v2) {
                return v1.toUpperCase() + v2;
            });
        case 2:
            return str.replace(/^(\w)(\w+)/, function (v, v1, v2) {
                return v1.toLowerCase() + v2;
            });
        case 3:
            return ToggleCase(str);
        case 4:
            return str.toUpperCase();
        case 5:
            return str.toLowerCase();
        default:
            return str;
    }
}
/*
if (!String.prototype.includes) {
  String.prototype.includes = function(search, start) {
    'use strict';
    if (typeof start !== 'number') {
      start = 0;
    }
    
    if (start + search.length > this.length) {
      return false;
    } else {
      return this.indexOf(search, start) !== -1;
    }
  };
}*/
