/* 与 node edge 无关的js */
var package_id = '${param.processid}';
package_id = package_id.indexOf('Package_') !== -1 ? package_id : 'Package_'+randomWord(false, 8);
var workflow_name = '过程';
var workflow_id = package_id+'_Wor1';
var create_time = new Date().pattern('yyyy-MM-dd HH:mm:ss');// 需要从xpdl读取
var create_type = '${param.kind}';
create_type = create_type.indexOf('param.kind') !== -1 ? create_type : 'create';// html防止报错

// 定义生成 node id 序列
var seqer_nodeID = serial_marker();
seqer_nodeID.set_prefix(workflow_id + '_Act');

// 定义生成 edge id 序列
var seqer_edgeID = serial_marker();
seqer_edgeID.set_prefix(workflow_id + '_Tra');

// 定义生成 参与者id 序列
var seqer_participantID = serial_marker();
seqer_participantID.set_prefix(workflow_id + '_Par');

// 定义生成 块活动blockId 序列
var seqer_blockId = serial_marker();
seqer_blockId.set_prefix(workflow_id + '_Ase');

$('.full-right>.menu').on('click', '.item', function() {
	var activitysetid = $(this).attr('activitysetid'); // 编辑快活动id
	if (activitysetid) {
		seqer_nodeID.set_prefix(activitysetid + '_Act');
	} else {
		seqer_nodeID.set_prefix(workflow_id + '_Act');
	}

	var containerId = $(this).attr('data-tab'); // graph.containerId
	graphPool.updateGraphActiveById(containerId);
});

$(function() {
	// 数据表格添加点击选中行
	$('.toolgrid,.extended_attr,.post_condition,.prop_edge,.role_manage').on('click', 'tbody tr', function() {
		$(this).addClass('active').siblings().removeClass('active');
		$(this).find('input:radio').prop('checked','checked');
	});	
	
	$('.monitorinf,.conventional_definition,.timeout_limit,.monitorinfAddDefinition tbody').on('click', 'tr', function() {
		$(this).addClass('active').siblings().removeClass('active');
	});	
	
	$('.front_condition .dropdown.convergeType').on('change', function(e) {
		var convergeType = $(this).val();
		if (convergeType == 0) { // 空
			$('.otherOpt>div').addClass('hideDiv');
		}
		if (convergeType == 'AND') { // And
			$('.otherOpt>div').eq(0).removeClass('hideDiv');
			$('.otherOpt>div').eq(1).addClass('hideDiv');
		}
		if (convergeType == 'XOR') { // Xor
			$('.otherOpt>div').eq(0).addClass('hideDiv');
			$('.otherOpt>div').eq(1).removeClass('hideDiv');
		}
	});
/*
	// 编辑工具(保存)
	$('.editor-toolbar .icon.save').on('click', function() {
		var dataTab = $('.full-right-btn .item.active').attr('data-tab');
		$('.tab[data-tab="tab_main"] .item').not($('.full-right-btn .item.active')).trigger('click');//触发点击事件获取xpdl和xml
		$('.full-right-btn .item[data-tab="'+dataTab+'"]').trigger('click');
		var xpdl = $('#xpdlContainer xmp').text();
		var xml = $('#xmlContainer xmp').text();
		var xpdl_top =
			'<?xml version="1.0" encoding="UTF-8" standalone="no"?>'+
		    '<Package xmlns="http://www.wfmc.org/2002/XPDL1.0" xmlns:xpdl="http://www.wfmc.org/2002/XPDL1.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="'+package_id+'" Name="新包" xsi:schemaLocation="http://www.wfmc.org/2002/XPDL1.0 http://wfmc.org/standards/dtd/TC-1025_schema_10_xpdl.xsd">'+
		    '    <PackageHeader>'+
		    '        <XPDLVersion>1.0</XPDLVersion>'+
		    '        <Vendor>GENTLESOFT</Vendor>'+
		    '        <Created>'+create_time+'</Created>'+
		    '    </PackageHeader>'+
		    '    <RedefinableHeader PublicationStatus="UNDER_TEST">'+
		    '        <Author>管理员</Author>'+
		    '        <Version>1.0</Version>'+
		    '    </RedefinableHeader>'+
		    '    <ConformanceClass GraphConformance="NON_BLOCKED"/>'+
		    '    <Script Type="text/javascript"/>'+
		    '    <DataFields>'+
		    '        <DataField Id="sourceReferenceId" IsArray="FALSE" Name="sourceReferenceId">'+
		    '            <DataType>'+
		    '                <BasicType Type="STRING"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '        <DataField Id="formId" IsArray="FALSE" Name="formId">'+
		    '            <DataType>'+
		    '                <BasicType Type="STRING"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '        <DataField Id="nextActivityInfo" IsArray="FALSE" Name="nextActivityInfo">'+
		    '            <DataType>'+
		    '                <ExternalReference location="org.gentlesoft.wf.NextActivitiesParty"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '        <DataField Id="nextActivityName" IsArray="FALSE" Name="nextActivityName">'+
		    '            <DataType>'+
		    '                <ExternalReference location="java.util.ArrayList"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '        <DataField Id="formType" IsArray="FALSE" Name="formType">'+
		    '            <DataType>'+
		    '                <BasicType Type="STRING"/>'+
		    '            </DataType>'+
		    '            <InitialValue>null</InitialValue>'+
		    '        </DataField>'+
		    '    </DataFields>';
		var xpdl_end = 
			'    <ExtendedAttributes>'+
		    '        <ExtendedAttribute Name="MadeBy" Value="com.gentlesoft.tools.wfd"/>'+
		    '        <ExtendedAttribute Name="Version" Value="1.4.2"/>'+
		    '    </ExtendedAttributes>'+
		    '</Package>';
		var xml_top = '<?xml version="1.0" encoding="UTF-8"?><pkg-config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Id="'+package_id+'" Name="新包" Version="" xsi:noNamespaceSchemaLocation="../dtd/flowactconfig.xsd">';
		var xml_end = '</pkg-config>';
		xpdl = vkbeautify.xml(xpdl_top + xpdl + xpdl_end);
		xml = vkbeautify.xml(xml_top + xml + xml_end);
		$('input[name="xpdlcontent"]').val(xpdl);
		$('input[name="xmlcontent"]').val(xpdl);
		$('#containerForm').submit();
	});*/
});
	    
/*  */
$(function() {
	var initProp = '<div>'+
				   '	<div name="id" class="prop-value"><span>id:</span><span>'+workflow_id+'</span></div>'+
				   '	<div name="name" class="prop-value"><span>名称:</span><span>'+workflow_name+'</span></div>'+
				   '</div>'+
				   '<div class="clearfix"></div>';
	$('.component-prop').append(initProp);
	$('.component-name span').text(workflow_name);
	$('.menu .item').tab();// 标签显示必须放updateScrollbar之前

	$('.menu .item').on('click', updateScrollbar);

	// 控制属性显示
	$('.full-right').on('click', '.component-name', function() {
		var parent = $(this).parents('div[data-tab]');
		var ishidden = parent.find('.component-prop').is(':hidden');
		if (ishidden) {
			parent.find('.full-right-bottom ').css({height: '26%'});
			parent.find('.component-name').css({height: '28%'});
			parent.find('.view').css({height: '68%'});
			parent.find('.component-name .icon').removeClass('up').addClass('down');
			parent.find('.component-prop').toggle('slow');
		} else {
			parent.find('.full-right-bottom ').css({height: '8%'});
			parent.find('.component-name').css({height: '100%'});
			parent.find('.view').css({height: '86%'});
			parent.find('.component-name .icon').removeClass('down').addClass('up');
			parent.find('.component-prop').toggle();
		}
	});
});
		
$(function() {
	$('#rMenu').on('mouseleave', function() {
		$('#rMenu').hide();
		// $('#rMenu .item').off('click');
	});
	// semantic初始化
	$('.pop-btn').popup();
	// jquery插件滚动条
	$(".content-div, .postCondi_extendedAttr, .conditionList, .conditionList2").mCustomScrollbar();

	// 活动属性semantic初始化
	$('.prop_node .menu .item').tab();
	/* IE11下 Semantic UI 存在问题
	$('.prop_node>.menu .item').on('click', function() {
		var item = $(this).attr('data-tab');
		$('.prop_node [data-tab="'+item+'"]').find('.content-div').mCustomScrollbar("update");
		if (item == 'four') {
			$('.post_condition .postCondi_extendedAttr').mCustomScrollbar("update");
			$('.prop_node.modal').css({
				height: '745px'
			});
			$('.prop_node>.tab').css({
				height: '608px'
			});
		} else {
			$('.prop_node.modal').css({
				height: '577px'
			});
			$('.prop_node>.tab').css({
				height: '447px'
			});
		}
	});*/

	// 后置条件下的tab
	$('.targetActivity .menu .item').on('click', function() {// 防止切换切换标签时滚动条消失
		var item = $(this).attr('data-tab');
		if (item == 'four/b') {
			$('.conditionDiv .conditionList').mCustomScrollbar("update");
		}
		if (item == 'four/a') {
			$('.targetActivity .postCondi_extendedAttr').mCustomScrollbar("update");
		}
	});

	$('select.dropdown').dropdown();

	$('.ui.checkbox').checkbox({
		onChecked: function() {
			$(this).parents('.checkbox').find('input[name]').val(true);
		},
		onUnchecked: function() {
			$(this).parents('.checkbox').find('input[name]').val(false);
		}
	});

	// checkbox 多人处理是否顺序执行 
	$('.checkbox.assignmentsOrderDiv').checkbox({
    	onChecked: function() {
    		$(this).parents('.checkbox').find('input[name]').val(true);
			$('.checkbox.completeAllAssignmentsDiv').checkbox('check');
		},
		onUnchecked: function() {
			$(this).parents('.checkbox').find('input[name]').val(false);
		}
	});

	// checkbox 是否多人处理
	$('.checkbox.completeAllAssignmentsDiv').checkbox({
    	onChecked: function() {
    		$(this).parents('.checkbox').find('input[name]').val(true);
		},
		onUnchecked: function() {
			$('.checkbox.assignmentsOrderDiv').checkbox('uncheck');
			$(this).parents('.checkbox').find('input[name]').val(false);
		}
	});

	$('.front_condition .radio.checkbox').checkbox({
		onChecked: function() {
			$('.front_condition').find('input[name=isCreateNew]').val($(this).attr('tabindex'));
	    }
	});

	/* 活动属性-常规-定义 */
	$(document).on('click', '.conventional .definitionBtn', function() {
		$('.conventional_definition.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        	$(this).find('tbody').empty();
	        	$('.conventional_definition .menu .item[data-tab="definition_1"]').trigger('click');
	        	$('.conventional_definition').find('.menu .item[data-tab="definition_2/processer"]').show();
	        	$('.conventional_definition').find('.menu .item[data-tab="definition_2/historyactselect"]').hide();
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 活动属性-工具-添加 */
	$(document).on('click', '.modal.prop_node .toolAddBtn', function() {
		$('.tool_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 活动属性-工具-添加-扩展属性添加 */
	$(document).on('click', '.modal.tool_add .actualParametersAdd2', function() {
		$('.tool_extendAttr_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tool_add').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tool_add').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 活动属性-后置条件-扩展属性-添加 */
	$(document).on('click', '.post_condition .extendAttrAddBtn', function() {
		$('.postCondition_extendAttr_add.modal').modal({
			allowMultiple: true,
			autofocus: true,
			duration: {},
			onHidden: function() {
				$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        	$('.postCondition_extendAttr_add .green.button').data('event_source', '.post_condition');
	        }
		}).modal('show');
	});

	/* 连线属性-扩展属性-添加 */
	$(document).on('click', '.prop_edge .extendAttrAddBtn', function() {
		$('.postCondition_extendAttr_add.modal').modal({
			allowMultiple: true,
			autofocus: true,
			duration: {},
			onHidden: function() {
				$('.modal.prop_edge').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_edge').dimmer({closable: false}).dimmer('show');
	        	$('.postCondition_extendAttr_add .green.button').data('event_source', '.prop_edge');
	        }
		}).modal('show');
	});

	/* 活动属性-后置条件-条件设置-关系设置 */
	$(document).on('click', '.relationshipPlaBtn', function() {
		var num = $('.workflowbeanDiv tbody tr').length;
		if (num) {
			$('.relationshipPlacement.modal').modal({
				allowMultiple: true,
				autofocus: false,
				duration: {},
				onHidden: function() {
					$('.modal.prop_node, .modal.prop_edge').dimmer('hide');
		        	clearModal(this);
		        },
				onShow: function() {
		        	$('.modal.prop_node, .modal.prop_edge').dimmer({closable: false}).dimmer('show');
		        	$('.relationshipPlacement .condition_no').empty();
		        	for (var i = 0; i < num; i++) {
		        		$('.relationshipPlacement .condition_no').append(
		        			'<div class="inline field">'+
						   	'  	<div class="ui checkbox">'+
						   	'  	  	<input type="checkbox" tabindex="0" class="hidden">'+
						   	'  	  	<label>${'+(i+1)+'}</label>'+
						   	'  	  	<input type="hidden" name="${'+(i+1)+'}" value="">'+
						   	'  	</div>'+
						   	'</div>');
		        	}
		        	$('.relationshipPlacement .condition_no').find('.ui.checkbox').checkbox({
						onChecked: function() {
							$(this).parents('.checkbox').find('input[name]').val(true);
						},
						onUnchecked: function() {
							$(this).parents('.checkbox').find('input[name]').val(false);
						}
					});
		        }
			}).modal('show');
		} else {
			layer.msg('请添加条件!', {time: 2000, icon:2});
		}
	});

	/* 活动属性-扩展属性-添加 */
	$(document).on('click', '.extended_attr .extendAttrAddBtn', function() {
		$('.extendAttr_add.modal').modal({
			allowMultiple: true,
			autofocus: true,
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 超时限制-增加 */
	$(document).on('click', '.modal.prop_node .timeoutLimitAddBtn', function() {
		$('.timeoutLimit_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 监控信息-增加 */
	/*$('.monitorinf_add.modal').modal({
		allowMultiple: true,
		autofocus: false, 
		duration: {},
		onHidden: function() {
        	$('.modal.prop_node').dimmer('hide');
        	clearModal(this);
        },
		onShow: function() {
        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
        }
	}).modal('attach events', '.modal.prop_node .monitorinfAddBtn'); //attach events 在firefox下存在问题*/

	$(document).on('click', '.modal.prop_node .monitorinfAddBtn', function() {
		$('.monitorinf_add.modal').modal({
			allowMultiple: true,
			autofocus: false, 
			duration: {},
			onHidden: function() {
	        	$('.modal.prop_node').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.prop_node').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 监控信息-增加-定义 */
	$(document).on('click', '.modal.monitorinf_add .definitionBtn', function() {
		$('.monitorinfAddDefinition.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.monitorinf_add').dimmer('hide');
	        	clearModal(this);
	        	$(this).find('tbody').empty();
	        },
			onShow: function() {
	        	$('.modal.monitorinf_add').dimmer({closable: false}).dimmer('show');
	        	$('.monitorinfAddDefinition select[name="definition_role"]').dropdown('set selected', 'responsible');
	        }
		}).modal('show');
	});

	/* 工具-添加-定义 */
	$(document).on('click', '.modal.tool_add .definitionBtn', function() {
		$('.tooldefinition.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tool_add').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tool_add').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 工具-添加-定义-添加 */
	$(document).on('click', '.modal.tooldefinition .tooldefinitionAddBtn', function() {
		$('.tooldefinition_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tooldefinition').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tooldefinition').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 工具-添加-定义-添加-添加 */
	$(document).on('click', '.modal.tooldefinition_add .tooldefinitionAddAddBtn', function() {
		$('.tooldefinition_add_add.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tooldefinition_add').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tooldefinition_add').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 工具-添加-添加 */
	$(document).on('click', '.modal.tool_add .actualParametersAdd1', function() {
		$('.actualParametersDiv.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.tool_add').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.tool_add').dimmer({closable: false}).dimmer('show');
	        	//ajax请求角色数据
	        }
		}).modal('show');
	});

	/* 工具-添加-添加-定义 */
	$(document).on('click', '.modal.actualParametersDiv .definitionBtn', function() {
		$('.toolAddDefinition.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.actualParametersDiv').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.actualParametersDiv').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 工具-添加-添加-定义-添加 */
	$(document).on('click', '.modal.toolAddDefinition .toolAddDefinitionAddBtn', function() {
		$('.toolAddDefinitionAdd.modal').modal({
			allowMultiple: true,
			autofocus: false,
			duration: {},
			onHidden: function() {
	        	$('.modal.toolAddDefinition').dimmer('hide');
	        	clearModal(this);
	        },
			onShow: function() {
	        	$('.modal.toolAddDefinition').dimmer({closable: false}).dimmer('show');
	        }
		}).modal('show');
	});

	/* 常规-定义-高级-一般 类型 onChange 事件 */
	$('.def_common [data-tab$="/commonly"] select[name=definition_type]').on('change', function() {
		$(this).parents('[data-tab$="/commonly"]').find('input').val('');
	});

    /* 点击显示树形结构div */
	$('input[name="def_name_show"]').on('click', function() {
		var def_type = $(this).parents('.modal').find('.tab[data-tab$="/commonly"] select[name=definition_type]').val();
		if (!def_type) {
			layer.msg('先选择类型！', {time: 2000, icon:0, offset: '180px'});
			return;
		}
		if (def_type.indexOf('role') != -1) {// 类型-角色
			$('.role_manage.modal').modal({
				allowMultiple: true,
				autofocus: false,
				duration: {},
				onHidden: function() {
		        	$('.modal.conventional_definition,.modal.monitorinfAddDefinition').dimmer('hide');
		        	clearModal(this);
		        },
				onShow: function() {
		        	$('.modal.conventional_definition,.modal.monitorinfAddDefinition').dimmer({closable: false}).dimmer('show');
		        	selectInfo(1, 15);
		        }
			}).modal('show');
			return;
		}
		// 根据类型 定义url
		var url = '';
		if (def_type == 'human|人') {
			url = 'platform/person/userTree.do?state=';
		} else if (def_type.indexOf('org') != -1) {
			url = 'platform/organise/organiseTree.do?state=';
		} else if (def_type == 'allParty|所有人【人】') {
			layer.msg('不需要填写！', {time: 2000, icon:4});
			return;
		}

		var setting = {
			view: {
				dblClickExpand: false
			},
			check: {
				enable: true,
				chkStyle: "radio",
				radioType: "all"
			},
			callback: {
				onClick: OnClick,
				onAsyncSuccess: onsuccess 
			},
			async: {  
				autoParam: ["id=node", "value=parentId"], 
				otherParam: {}, 
				contentType: "application/x-www-form-urlencoded;charset=UTF-8",  
				enable: true,  
				type: "post",  
				url: url,
				dataFilter: ajaxDataFilter
			},
			data:{  
				simpleData: {
					enable: true,
					rootPId: "xnode-40"
				} 
			} 
		};

		treelayer = layer.open({
		  	type: 1,
		  	title: 'PersonTree',
		  	skin: 'layui-layer-rim', // 边框
		  	area: ['300px', '350px'], // 宽高
		  	offset: ['167px', '587px'],
		  	content: '<div id="treeDemo_div" style="height:98%">'+
		  				'<ul id="treeDemo" class="ztree">'+
		  				'</ul>'+
		  				'<div class="buttons_bottom">'+
			  				'<div class="ui horizontal divider">'+
			  					'<button class="ui primary mini button">确定</button>'+
								'<button class="ui cancel mini button">取消</button>'+
							'</div>'+
						'</div>'+
					 '</div>'
		});
		/* ztree */
		$.fn.zTree.init($("#treeDemo"), setting);
		zTree = $.fn.zTree.getZTreeObj("treeDemo");
	});
	// 树形结构下 取消
	$(document).on('click', '#treeDemo_div .cancel', function() {
		layer.close(treelayer);
	});
	// 树形结构下 确定
	$(document).on('click', '#treeDemo_div .primary', function() {
		var nodes = zTree.getCheckedNodes(true);
		if (nodes.length) {
			if ($('.conventional_definition').is(':visible')) {
				$('.conventional_definition input[name=def_name_show]').val(nodes[0].name);
				$('.conventional_definition input[name=definition_name]').val(nodes[0].value + '|' + nodes[0].name);
			} else {
				$('.monitorinfAddDefinition input[name=def_name_show]').val(nodes[0].name);
				$('.monitorinfAddDefinition input[name=definition_name]').val(nodes[0].value + '|' + nodes[0].name);
			}
		} else {
			layer.msg('请选中元素！', {time: 2000, icon: 0, offset: ['270px','650px']});
			return;
		}
		layer.close(treelayer);
	});
	// 角色管理-搜索
	$('.role_manage .search.icon').on('click', function() {
		selectInfo(1, 15);
	});
	// 角色管理-重置
	$('.role_manage .resetBtn').on('click', function() {
		$(this).siblings('.role-search').find('input').val('');
		$('.role_manage .search.icon').trigger('click');
	});
	// 角色管理-确定
	$('.role_manage .okBtn').on('click', function() {
		var jsonstr = $(this).parents('#role-center').find('tr.active').attr('jsonstr');
		if (jsonstr) {
			var jsonobj = JSON.parse(jsonstr);
			if ($('.conventional_definition').is(':visible')) {
				$('.conventional_definition input[name=def_name_show]').val(jsonobj.ROLENAME);
				$('.conventional_definition input[name=definition_name]').val(jsonobj.ROLEID + '|' + jsonobj.ROLENAME);
			} else {
				$('.monitorinfAddDefinition input[name=def_name_show]').val(jsonobj.ROLENAME);
				$('.monitorinfAddDefinition input[name=definition_name]').val(jsonobj.ROLEID + '|' + jsonobj.ROLENAME);
			}
			$(this).parents('.modal').modal('hide');
		} else {
			layer.msg('请选中元素！', {time: 2000, icon: 0, offset: '180px'});
			return;
		}
	});

	
});

// 清空表单
function clearModal(selector) {
	$(selector).find('input, textarea').val('');
   	$(selector).find('.ui.dropdown').dropdown('clear');
}

// 刷新显示滚动条
function updateScrollbar() {
	var dataTab = $(this).attr('data-tab');
	if (dataTab == 'third') { //xml视图
		$("#xmlContainer").mCustomScrollbar("update");
	}
	if (dataTab == 'second') { //xpdl视图
		$("#xpdlContainer").mCustomScrollbar("update");
	}
}

// zTree 数据过滤
function ajaxDataFilter(treeId, parentNode, responseData) {
    if (responseData) {
      for (var i = 0; i < responseData.length; i++) {
        responseData[i].name = responseData[i].text;
        responseData[i].open = responseData[i].expanded;
        responseData[i].isParent = !responseData[i].leaf;
        responseData[i].nocheck = responseData[i].checked == false ? false : true;
      }
    }
    return responseData;
}

// zTree 点击节点
function OnClick(event, treeId, treeNode) {
	zTree.checkNode(treeNode, true, false);
}

// zTree onsuccess
function onsuccess(event, treeId, treeNode, msg) {
	try {
	    var dataJson = JSON.parse(msg);
		if (!dataJson.length) return;
		if (dataJson[0].id == 'root-root' && dataJson[0].expanded) {
			var node = zTree.getNodeByParam("id", dataJson[0].id);
			zTree.expandNode(node, true);
		}
	} catch (e) {
		layer.msg('platform 未登录！', {time: 2000, icon:2});
		console.error('platform 未登录！');
	    //window.location.href = "https://segmentfault.com/search?q=[js]+" + e.message;
	}
}

// 角色管理分页
function selectInfo(offset, size) {
	if (offset) {
 		$(".role_manage #offset").val(offset);
 	}
 	if (size) {
 		$(".role_manage #size").val(size);
 	}
 	$("#searchForm").trimForm().ajaxSubmit({
	    url: "platform/role/query.do?hyper=false",
 		type: "post",
 		data: {
 			"start": (offset-1)*size,
        	"limit": size //后台用的默认参数15，传值无效
        },
        dataType: "json",
	    success: function(result) {
	        $('.role_manage .content-tab').empty();
	        if (result.totalCount) {
	            $.pages({
	                count: result.totalCount, //总数量
	                curr: offset, //初始化当前页
	            }, selectInfo, size);
	            //显示数据
				$('.role_manage .content-tab').html(juicer($('#role_manage_tpl').html(), result));
				$('.role_manage .content-tab').find('.ui.checkbox').checkbox();
	        } else {
				$('.role_manage .content-tab').html('<div class="no-info">暂无信息...</div>');
			}
	    },
		error: function(data) {
			alert("服务器繁忙,请稍后再试...");
		}
	});
}

/*-------------初始化 tab select start-------------*/
initSelect();
		
function initSelect() {
	$.ajax({
	    url: 'wfConf/WfDSystemConfig.xml',
	    dataType: 'xml',
	    success: function(data) {
	        //console.log(data);
	        window.wfdConfig = data;
	        //下拉列表
	        $(data).find('selects select').each(function() {
	            var selectId = $(this).attr('id');
	            var select = {selectId: selectId, options: []};
	            $(this).find('selectOption').each(function() {
	            	var option = {
	            			value: $(this).attr('value'),
	            			show: $(this).text()
	            		};
	            	select.options.push(option);
		        });
	            $('.'+selectId).append(juicer($('#select_tpl').html(), select))
	            			   .find('.ui.dropdown').dropdown();
	            if (selectId == 'transitionEventType') {
	            	// 后置条件-条件设置-业务对象
	            	select.bean = { opts: [] };
			        $(data).find('beanconditionsdefs beanconditionsdef').each(function() {
			        	var option = {
				        	name: $(this).attr('name'),
				        	value: $(this).attr('id')
			        	};
			        	select.bean.opts.push(option);
			        });
	            	$('#transition_tpl').html(juicer($('#transition_tpl').html(), select));
	            }
		    });
	        var participant = {
                selectItems: []
            };
	        $(data).find('participant-option select-item').each(function() {
	            var selectItem = {
                	key: $(this).attr('key'),
                	displayName: $(this).attr('display-name'),
                	selectTypes: []
	            };
	            $(this).find('select-type').each(function() {
	              	var selectType = {
                		key: $(this).attr('key'),
                		name: $(this).attr('name')
	              	};
	              	selectItem.selectTypes.push(selectType);
	            });
	            participant.selectItems.push(selectItem);
	        });
	        $('.conventional_definition').append(juicer($('#participant_tpl').html(), participant));
	        $('.conventional_definition').find('.menu .item').tab();
	        $('.conventional_definition').find('select.dropdown').dropdown();

	    }
	});
}
/*-------------初始化 tab select end-------------*/
