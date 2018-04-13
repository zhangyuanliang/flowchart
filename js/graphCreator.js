/*jshint esversion: 6 */
document.onload = (function(d3, saveAs, Blob, vkbeautify) {
  "use strict";

  // define graphcreator object
  var GraphCreator = function(containerId, svg, nodes, edges, participants) {
    var thisGraph = this;
    console.log('thisGraph:');
    console.log(thisGraph);

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];
    thisGraph.participants = participants || [];
    thisGraph.containerId = containerId;

    thisGraph.state = {
      activeEdit: true,
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      selectedText: null,
      drawLine: ''
    };

    // define arrow markers for graph links
    var defs = svg.append('defs');
    defs.append('svg:marker')
      .attr('id', thisGraph.containerId + '-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 42)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    //define arrow markers for leading arrow
    defs.append('marker')
      .attr('id', thisGraph.containerId + '-mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    //定义选中样式的箭头
    defs.append('marker')
      .attr('id', thisGraph.containerId + '-selected-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 30)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'rgb(229, 172, 247)');

    thisGraph.svg = svg;
    thisGraph.show_position = svg.append("text")
      .attr({
        'x': 1107,
        'y': 15,
        'fill': '#E1784B'
      });
    thisGraph.svgG = svg.append("g")
      .classed(thisGraph.consts.graphClass, true);
    var svgG = thisGraph.svgG;

    // displayed when dragging between nodes
    thisGraph.dragLine = svgG.append('path')
      .attr('class', 'link dragline hidden')
      .attr('d', 'M0,0L0,0')
      .style('marker-end', 'url(#'+thisGraph.containerId+'-mark-end-arrow)');

    // svg nodes and edges
    thisGraph.paths = svgG.append("g").selectAll("g");
    thisGraph.circles = svgG.append("g").selectAll("g");

    thisGraph.drag = d3.behavior.drag()
      .origin(function(d) {
        // d = selected circle. The drag origin is the origin of the circle
        return {
          x: d.x,
          y: d.y
        };
      })
      .on("dragstart", function() {d3.select(this).select("circle").attr("r", thisGraph.consts.nodeRadius + thisGraph.consts.nodeRadiusVary);})
      .on("drag", function(args) {
        thisGraph.state.justDragged = true;
        thisGraph.dragmove.call(thisGraph, args);
      })
      .on("dragend", function(args) {
        // args = circle that was dragged
        d3.select(this).select("circle").attr("r", thisGraph.consts.nodeRadius - thisGraph.consts.nodeRadiusVary);
      });

    // listen for key events
    d3.select(window).on("keydown", function() {
        thisGraph.svgKeyDown.call(thisGraph);
      })
      .on("keyup", function() {
        thisGraph.svgKeyUp.call(thisGraph);
      });
    svg.on("mousedown", function(d) {
      thisGraph.svgMouseDown.call(thisGraph, d);
    });
    svg.on("mouseup", function(d) {
      thisGraph.svgMouseUp.call(thisGraph, d);
    });
    svg.on("mousemove", function(d) {
      thisGraph.show_position.text('pos: '+d3.mouse(svgG.node())[0].toFixed(0)+', '+d3.mouse(svgG.node())[1].toFixed(0));
    });

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
      .scaleExtent([0.3, 2])
      .on("zoom", function() {
        // console.log('zoom triggered');
        if (d3.event.sourceEvent.shiftKey) {
          // the internal d3 state is still changing
          return false;
        } else {
          thisGraph.zoomed.call(thisGraph);
        }
        return true;
      })
      .on("zoomstart", function() {
        // console.log('zoomstart triggered');
        var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
        if (ael) {
          ael.blur();
        }
        if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
      })
      .on("zoomend", function() {
        // console.log('zoomend triggered');
        d3.select('body').style("cursor", "auto");
      });
    thisGraph.dragSvg = dragSvg;
    svg.call(dragSvg).on("dblclick.zoom", null);

    // listen for resize
    window.onresize = function() {
      thisGraph.updateWindow(svg);
    };

    // handle download data
    d3.select("#download-input").on("click", function() {
      var saveEdges = [];
      thisGraph.edges.forEach(function(val, i) {
        saveEdges.push({
          source: val.source.id,
          target: val.target.id
        });
      });
      var blob = new Blob([window.JSON.stringify({
        "nodes": thisGraph.nodes,
        "edges": saveEdges
      })], {
        type: "text/plain;charset=utf-8"
      });
      saveAs(blob, "mydag.json");
    });


    // handle uploaded data
    d3.select("#upload-input").on("click", function() {
      document.getElementById("hidden-file-upload").click();
    });
    d3.select("#hidden-file-upload").on("change", function() {
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        var uploadFile = this.files[0];
        var filereader = new window.FileReader();
        
        filereader.onload = function() {
          var txtRes = filereader.result;
          // better error handling
          try {
            var jsonObj = JSON.parse(txtRes);
            thisGraph.deleteGraph();
            thisGraph.nodes = jsonObj.nodes;
            var newEdges = jsonObj.edges;
            newEdges.forEach(function(e, i) {
              newEdges[i] = {
                source: thisGraph.nodes.filter(function(n) {
                  return n.id == e.source;
                })[0],
                target: thisGraph.nodes.filter(function(n) {
                  return n.id == e.target;
                })[0]
              };
            });
            thisGraph.edges = newEdges;
            thisGraph.updateGraph();
          } catch (err) {
            window.alert("Error parsing uploaded file\nerror message: " + err.message);
            return;
          }
        };
        filereader.readAsText(uploadFile);

      } else {
        alert("Your browser won't let you save this graph -- try upgrading your browser to IE 10+ or Chrome or Firefox.");
      }

    });

    $('#flowComponents .components-btn[type]').not('.noComponent').attr('draggable', 'true')
      .on('dragstart', function(ev) {
        // $('.full-left').css({cursor: 'no-drop'});
        $(this).siblings().removeClass('active').end().addClass('active');
        $('.full-right>.tab.active .full-right-top').addClass('activate');
        /* 设置拖动过程显示图片
        var icon = document.createElement('img');
        icon.src = $(this).find('img').attr('src');
        ev.originalEvent.dataTransfer.setDragImage(icon,10,10);*/
        var json_obj = {
          text: $(this).attr('data-show'),
          component: $(this).attr('name'),
          type: $(this).attr('type')
        };
        ev.originalEvent.dataTransfer.setData('tr_data', JSON.stringify(json_obj));
      })
      .on('dragend', function(ev) {
        $('.full-right>.tab.active .full-right-top').removeClass('activate');
      }); 
    $('.full-right .tab.active').on('drop', '.svg-container', function(ev) {
      ev.stopPropagation(); 
      ev.preventDefault(); 
      var position = {
        x: parseFloat(ev.originalEvent.offsetX),
        y: parseFloat(ev.originalEvent.offsetY)
      };

      position = thisGraph.parsePosition(this, position);

      var data = JSON.parse(ev.originalEvent.dataTransfer.getData('tr_data'));
      data = $.extend(data, position);
      var node = thisGraph.createNode(data);

      thisGraph.nodes.push(node);
      thisGraph.updateGraph();

    })
    .on('dragover', function(ev) { 
      ev.preventDefault();
    });

    $('svg').on('click', function() {
      $('#rMenu').hide();
    });
    $('svg').on('contextmenu', function() {
      $('#flowComponents div[name=selectBtn]').trigger('click');
      return false;
    });

    //后置条件-扩展属性集-添加
    $('.postCondition_extendAttr_add .green.button').on('click', function() {
      var element_add = $('.postCondition_extendAttr_add.modal');
      var name = element_add.find('input[name="extendAttr_add_name"]').val();
      var value = element_add.find('input[name="extendAttr_add_value"]').val();
      if (!name) {
        layer.msg('请输入名称！', {time: 2000, icon:2});
        return false;
      }
      if (!value) {
        layer.msg('请输入值！', {time: 2000, icon:2});
        return false;
      }
      var data = {name: name, value: value};
      data = {data: data, jsonstr: JSON.stringify(data)};
      var html = juicer($('#extended_attr_tpl').html(), data);
      var operate = element_add.find('input[name="extendAttr_add_operate"]').val();
      if (operate) {
        var event_source = $(this).data('event_source');
        var selectedTr = $(event_source).find('.transferInf_extended_attr tbody tr.active');
        selectedTr.attr('jsonstr', data.jsonstr);
        selectedTr.find('td').eq(1).text(data.data.name);
        selectedTr.find('td').eq(2).text(data.data.value);
      } else {
        var element_attr = $('.targetActivity .transferInf_extended_attr');
        element_attr.find('tbody').append(html).find('.ui.checkbox').checkbox();
        element_attr.find('.postCondi_extendedAttr').mCustomScrollbar("update");
        element_attr.find('.postCondi_extendedAttr').mCustomScrollbar("scrollTo", "bottom", {scrollInertia: 1500});
      }
      element_add.find('input').val("");
    });

    //后置条件-扩展属性集-编辑
    $('.targetActivity').on('click', '.transferInf_extended_attr .extendAttrEditBtn', function() {
      var selectedTr = $(this).parents('.grid').find('tbody tr.active');
      if (selectedTr.length < 1) {layer.msg('请选择一行!', {time: 2000, icon: 0}); return false;}
      var jsonstr = $(this).parents('.grid').find('tbody tr.active').attr('jsonstr');
      var json = JSON.parse(jsonstr);
      var element = $('.postCondition_extendAttr_add.modal');
      element.find('input[name="extendAttr_add_name"]').val(json.name);
      element.find('input[name="extendAttr_add_value"]').val(json.value);
      element.find('input[name="extendAttr_add_operate"]').val("1");
      $('.transferInf_extended_attr .extendAttrAddBtn').trigger('click');
    });
    //后置条件-扩展属性集-删除
    $('.targetActivity').on('click', '.transferInf_extended_attr .extendAttrDelBtn', function() {
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length > 0) {
        tr.remove();
        $('.transferInf_extended_attr .postCondi_extendedAttr').mCustomScrollbar('update');
      } else {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
      }
    });

    //扩展属性集-添加
    $('.extendAttr_add .green.button').on('click', function() {
      var name = $('.extendAttr_add.modal input[name="extendAttr_add_name"]').val();
      var value = $('.extendAttr_add.modal input[name="extendAttr_add_value"]').val();
      if (!name) {
        layer.msg('请输入名称！', {time: 2000, icon:2});
        return false;
      }
      if (!value) {
        layer.msg('请输入值！', {time: 2000, icon:2});
        return false;
      }
      var data = {name: name, value: value};
      data = {data: data, jsonstr: JSON.stringify(data)};
      var html = juicer($('#extended_attr_tpl').html(), data);
      var operate = $('.extendAttr_add.modal input[name="extendAttr_add_operate"]').val();
      if (operate) {
        var selectedTr = $('.extended_attr tbody tr.active');
        selectedTr.attr('jsonstr', data.jsonstr);
        selectedTr.find('td').eq(1).text(data.data.name);
        selectedTr.find('td').eq(2).text(data.data.value);
      } else {
        $('.extended_attr tbody').append(html).find('.ui.checkbox').checkbox();
      }
      $('.extendAttr_add.modal input').val("");
    });

    //扩展属性集-编辑
    $('.extended_attr .extendAttrEditBtn').on('click', function() {
      var selectedTr = $(this).parents('.grid').find('tbody tr.active');
      if (selectedTr.length<1) {layer.msg('请选择一行!', {time: 2000, icon: 0}); return false;}
      var jsonstr = $(this).parents('.grid').find('tbody tr.active').attr('jsonstr');
      var json = JSON.parse(jsonstr);
      $('.extendAttr_add.modal input[name="extendAttr_add_name"]').val(json.name);
      $('.extendAttr_add.modal input[name="extendAttr_add_value"]').val(json.value);
      $('.extendAttr_add.modal input[name="extendAttr_add_operate"]').val("1");
      $('.extended_attr .extendAttrAddBtn').trigger('click');
      // $('.extendAttr_add.modal').modal('show'); //会关闭一级弹窗
    });

    //扩展属性集-删除
    $('.extended_attr .extendAttrDelBtn').on('click', function() {
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length > 0) {
        tr.remove();
      } else {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
      }
    });

    //超时限制-增加-确定
    $('.timeoutLimit_add .green.button').on('click', function() {
      var deadline = {};
      $('.timeoutLimit_add').find('input[name], select').each(function() {
        deadline[$(this).attr('name')] = $(this).val();
      });
      if (!deadline.deadlineCondition) {
        layer.msg('请输入持续时间！', {time: 2000, icon:2});
        return false;
      }
      if (!deadline.exceptionName) {
        layer.msg('请输入异常名称！', {time: 2000, icon: 2});
        return false;
      }
      var operate = $('.timeoutLimit_add.modal input[name="timeoutLimit_add_operate"]').val();
      if (operate) {//编辑操作
        var selectedTr = $('.timeout_limit tbody tr.active');
        selectedTr.attr('jsonstr', JSON.stringify(deadline));
        selectedTr.find('td').text(deadline.deadlineCondition);
      } else {
        $('.timeout_limit tbody').append('<tr jsonstr= '+JSON.stringify(deadline)+'><td>'+deadline.deadlineCondition+'</td></tr>');
        $(".timeout_limit_grid .content-div").mCustomScrollbar("update");
        $(".timeout_limit_grid .content-div").mCustomScrollbar("scrollTo", "bottom", {scrollInertia: 1500});
      }
    });

    //超时限制-删除
    $('.timeoutLimitRemoveBtn').on('click', function() {
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length > 0) {
        tr.remove();
        $(".timeout_limit_grid .content-div").mCustomScrollbar("update");
      } else {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
      }
    });

    //超时限制-编辑
    $('.timeoutLimitEditBtn').on('click', function(){
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length == 0) {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
        return false;
      }
      var data = JSON.parse(tr.attr('jsonstr'));
      for (var key in data) {
        $('.timeoutLimit_add').find('input[name="'+key+'"]').val(data[key]);
      }
      $('.timeoutLimit_add').find('select').dropdown('set selected', data.execution);
      $('.timeoutLimit_add.modal input[name="timeoutLimit_add_operate"]').val("1");
      $('.timeoutLimitAddBtn').trigger('click');
    });

    //常规-定义
    $('.conventional').on('click', '.definitionBtn', function(event) {
      var selectedNode = thisGraph.state.selectedNode;
      var rol_id = $('.conventional select[name="definition_role"]').siblings('.text').attr('definition_id');
      $('.conventional_definition').find('.menu .item[data-tab="definition_2/processer"]').hide();
      $('.conventional_definition').find('.menu .item[data-tab="definition_2/historyactselect"]').hide();
      var hasLinked = thisGraph.hasLinked(selectedNode, true, -1);
      if (hasLinked) {
        var select = {
          selectId: 'definition_name', 
          options: [{
            value: selectedNode.id+'|'+selectedNode.title, 
            show: selectedNode.title 
          }]
        };
        var edges = thisGraph.getLinkedEdges(selectedNode, -1);
        var options = edges.filter(function(edge) {
          return edge.source.type == 'activity';
        }).map(function(edge) {
          return {
            value: edge.source.id+'|'+edge.source.title,
            show: edge.source.title
          };
        });
        select.options = select.options.concat(options);
        $('.conventional_definition div.definition_name label').siblings().remove();
        $('.conventional_definition div.definition_name').append(juicer($('#select_tpl').html(), select))
                                                          .find('.ui.dropdown').dropdown();
        $('.conventional_definition').find('.menu .item[data-tab="definition_2/historyactselect"]').show();// 其它activity指向本，显示
      }
      if (rol_id) {// 编辑
        $('.conventional_definition input[name="conventional_def_operate"]').val(1);// 页面标记 1：代表编辑
        var participants = thisGraph.participants;
        thisGraph.participants.forEach(function(participant) {
          if (participant.conventional_definition_id == rol_id) {
            $('.conventional_definition div[data-tab="definition_1"]').find('input[name]:not(".hidden"), textarea').each(function() {
              $(this).val(participant[$(this).attr('name')]);
            });
            if (participant.typeName) {
              participant.typeName.forEach(function(item, i) {
                var itemValue_show = participant.itemValue[i].split('|')[1]? participant.itemValue[i].split('|')[1]:'',
                  itemValue = participant.itemValue[i]? participant.itemValue[i]:'',
                  itemName = participant.itemName[i].split('|')[1];
                $('.conventional_definition .definition_condition tbody').append(
                    '<tr>'+
                    '  <td name="typeName" value="'+item+'">'+item.split('|')[1]+'</td>'+
                    '  <td name="itemName" value="'+participant.itemName[i]+'">'+itemName+'</td>'+
                    '  <td name="itemValue" value="'+itemValue+'">'+itemValue_show+'</td>'+
                    '  <td name="secLevelS" value="'+participant.secLevelS[i]+'">'+participant.secLevelS[i]+'</td>'+
                    '  <td name="secLevelE" value="'+participant.secLevelE[i]+'">'+participant.secLevelE[i]+'</td>'+
                    '  <td name="roleName" value="'+participant.roleName[i]+'">'+participant.roleName[i]+'</td>'+
                    '</tr>');
              });
            }
          }
        });
      } else { //增加
        $('.conventional_definition input[name="conventional_definition_id"]').val(seqer_participantID.gensym());
      }
    });

    //常规-定义-高级-增加条件
    $('.conventional_definition').on('click', '.definition_addBtn', function() {
      var typeName = $('.conventional_definition [data-tab="definition_2"]>.menu>.item.active').attr('value'),
        data_tab = $('.conventional_definition [data-tab="definition_2"] .tab.active').attr('data-tab'),
        type = $('.conventional_definition div[data-tab="'+data_tab+'"] select[name="definition_type"]').val(),
        name = $('.conventional_definition div[data-tab="'+data_tab+'"] [name="definition_name"]').val() || '';
      var params = {};
      $('.conventional_definition div[data-tab="'+data_tab+'"]').find('input[name],select').each(function() {
        params[$(this).attr('name')] = $(this).val();
      });
      if (data_tab == 'definition_2/commonly' || data_tab == 'definition_2/historyactselect') {//类型--一般
        if (!type) {
          layer.msg('请选择类型!', {time: 2000, icon: 0});
          return;
        }
        if (type != 'allParty|所有人【人】' && !name) {
          layer.msg('请选择名称!', {time: 2000, icon: 0});
          return;
        }
      } else {
        if (!type) {
          layer.msg('请选择类型!', {time: 2000, icon: 0});
          return false;
        }
      }
      $('.conventional_definition [name="conventional_definition_participant"]').val("");//清除-自定义参数者
      $('.conventional_definition .definition_condition tbody').append(
                '<tr>'+
                '  <td name="typeName" value="'+typeName+'">'+(typeName.split('|')[1])+'</td>'+
                '  <td name="itemName" value="'+type+'">'+(type.split('|')[1])+'</td>'+
                '  <td name="itemValue" value="'+name+'">'+(name?name.split('|')[1]?name.split('|')[1]:name:'')+'</td>'+
                '  <td name="secLevelS" value="'+params.definition_param1+'">'+params.definition_param1+'</td>'+
                '  <td name="secLevelE" value="'+params.definition_param2+'">'+params.definition_param2+'</td>'+
                '  <td name="condition" value="fw=="></td>'+
                '</tr>');
      $(".conventional_definition .definition_condition").mCustomScrollbar("update");
      $(".conventional_definition .definition_condition").mCustomScrollbar("scrollTo", "bottom", {
        scrollInertia: 1500
      });
    });

    //常规-定义-高级-删除条件
    $('.conventional_definition').on('click', '.definition_removeBtn', function() {
      var select = $('.conventional_definition .definition_condition tbody tr.active');
      if (select.length > 0) {
        select.remove();
        $(".definition_condition").mCustomScrollbar("update");
      } else {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
      }
    });

    //常规-定义-确定
    $('.conventional_definition').on('click', '.green.button', function() {
      var operate = $('.conventional_definition input[name="conventional_def_operate"]').val(),
        currentId = $('.conventional_definition input[name="conventional_definition_id"]').val(),
        participant = {};
      $('.conventional_definition div[data-tab="definition_1"]').find('input[name]:not(".hidden"), textarea').each(function() {
        participant[$(this).attr('name')] = $(this).val();
      });
      if (participant.conventional_definition_participant) {// 自定义参与者
        
      } else {
        $('.conventional_definition div[data-tab="definition_2"] tbody').find('tr').each(function() {
          $(this).find('td').each(function(){
            participant[$(this).attr('name')] = participant[$(this).attr('name')] || [];
            participant[$(this).attr('name')].push($(this).attr('value'));
          });
          participant.roleName = participant.roleName || [];
          participant.roleName.push('party');// 常规定义参与者 角色默认是party
          // 以下几个属性不知道从哪里获取...???
          participant.isAppData = participant.isAppData || [];
          participant.isAppData.push('false');
          participant.condition = participant.condition || [];
          participant.condition.push('');
          participant.conditionXml = participant.conditionXml || [];
          participant.conditionXml.push('');
        });
      }

      if (operate) {// 1：编辑
        thisGraph.participants.forEach(function(item, i) {
          if (item.conventional_definition_id == currentId) {
            thisGraph.participants[i] = participant;
          }
        });
      } else {// '':保存
        thisGraph.participants.push(participant);
      }
      var rol = participant.conventional_definition_name?participant.conventional_definition_name + "-rol":participant.conventional_definition_id + "-rol";
      $('.conventional select[name="definition_role"]').dropdown('set text', rol);
      $('.conventional .dropdown .text').attr('definition_id', participant.conventional_definition_id);

    });
    
    //监控信息-删除
    $('.monitorinf .monitorinfRemoveBtn').on('click', function() {
      var selected = $('.monitorinf').find('tbody tr.active');
      if (selected.length) {
        var definition_id = selected.attr('definition_id');
        var responsible = thisGraph.state.selectedNode.monitorinf.responsible;
        responsible.forEach(function(resp, i) {
          if (resp == definition_id) responsible.splice(i, 1);
        });
        selected.remove();
        $(".monitorinf_grid .content-div").mCustomScrollbar("update");
      } else {
        layer.msg('请选择一行', {time: 2000, icon: 0});
      }
    });

    //监控信息-编辑
    $('.monitorinf .monitorinfEditBtn').on('click', function() {
      var selected = $('.monitorinf').find('tbody tr.active');
      if (selected.length) {
        var rol = selected.find('td').text(),
          rol_id = selected.attr('definition_id');
        $('.monitorinf_add input[name="monitorinf_add_operate"]').val(1);
        $('.monitorinf_add select[name="definition_role"]').dropdown('set text', rol);
        $('.monitorinf_add select[name="definition_role"]').siblings('.text').attr('definition_id', rol_id);
        $(this).siblings('.monitorinfAddBtn').trigger('click');
      } else {
        layer.msg('请选择一行', {time: 2000, icon: 0});
      }
    });

    //监控信息-增加-定义
    $('.monitorinf_add .definitionBtn').on('click', function() {
      var operate = $('.monitorinf_add input[name="monitorinf_add_operate"]').val();
      if (operate) { // 编辑
        var rol = $('.monitorinf_add .dropdown .text').attr('definition_id').replace('-rol', '');
        $('.monitorinfAddDefinition input[name="monitorinf_add_operate"]').val(operate);//隐藏域：1代表编辑 空代表增加
        var monitorinf = thisGraph.state.selectedNode.monitorinf;
        var participants = thisGraph.participants;
        participants.forEach(function(p) {
          if (p.conventional_definition_id == rol) {
            $('.monitorinfAddDefinition div[data-tab="definition_one"]').find('input[name]:not(".hidden"), textarea').each(function() {
              $(this).val(p[$(this).attr('name')]);
            });
            $('.monitorinfAddDefinition div[data-tab="definition_one"]').find('select').each(function() {
              $(this).dropdown('set selected', p[$(this).attr('name')]);
            });
            if (p.typeName) {
              p.typeName.forEach(function(tn, j) {
                var itemValue = p.itemValue[j]?p.itemValue[j].split('|')[1]?
                                  p.itemValue[j].split('|')[1]:p.itemValue[j]:'';
                $('.monitorinfAddDefinition .definition_condition tbody').append(
                    '<tr>'+
                    '  <td name="typeName" value="'+tn+'">'+tn.split('|')[1]+'</td>'+
                    '  <td name="itemName" value="'+p.itemName[j]+'">'+p.itemName[j].split('|')[1]+'</td>'+
                    '  <td name="itemValue" value="'+itemValue+'">'+itemValue+'</td>'+
                    '  <td name="secLevelS" value="'+p.secLevelS[j]+'">'+p.secLevelS[j]+'</td>'+
                    '  <td name="secLevelE" value="'+p.secLevelE[j]+'">'+p.secLevelE[j]+'</td>'+
                    '  <td name="roleName" value="'+p.roleName[j]+'">'+p.roleName[j]+'</td>'+
                    '</tr>');
              });
            }
          }
        });
      } else { //增加
        $('.monitorinfAddDefinition input[name="conventional_definition_id"]').val(seqer_participantID.gensym());
      }
    });

    //监控信息-增加-定义-高级-增加条件
    $('.monitorinfAddDefinition .monitorinfDefintionAddBtn').on('click', function() {
      var typeName = $('.monitorinfAddDefinition [data-tab="definition_two"]>.menu>.item.active').attr('value'),
        data_tab = $('.monitorinfAddDefinition [data-tab="definition_two"] .tab.active').attr('data-tab'),
        type = $('.monitorinfAddDefinition div[data-tab="'+data_tab+'"] select[name="definition_type"]').val(),
        name = $('.monitorinfAddDefinition div[data-tab="'+data_tab+'"] [name="definition_name"]').val() || '';
      var params = {};
      $('.monitorinfAddDefinition div[data-tab="'+data_tab+'"]').find('input[name],select').each(function() {
        params[$(this).attr('name')] = $(this).val();
      });
      if (data_tab == 'definition_two/a') {//类型--一般
        if (!type) {
          layer.msg('请选择类型!', {time: 2000, icon: 0});
          return;
        }
        if (type != 'allParty|所有人【人】' && !name) {
          layer.msg('请选择名称!', {time: 2000, icon: 0});
          return;
        }
      } else {
        if (!type) {
          layer.msg('请选择类型!', {time: 2000, icon: 0});
          return false;
        }
      }
      $('.monitorinfAddDefinition [name="conventional_definition_participant"]').val("");//清除-自定义参数者
      $('.monitorinfAddDefinition .definition_condition tbody').append(
                '<tr>'+
                '  <td name="typeName" value="'+typeName+'">'+typeName.split('|')[1]+'</td>'+
                '  <td name="itemName" value="'+type+'">'+(type.split('|')[1])+'</td>'+
                '  <td name="itemValue" value="'+name+'">'+(name?name.split('|')[1]?name.split('|')[1]:name:'')+'</td>'+
                '  <td name="secLevelS" value="'+params.definition_param1+'">'+params.definition_param1+'</td>'+
                '  <td name="secLevelE" value="'+params.definition_param2+'">'+params.definition_param2+'</td>'+
                '  <td name="roleName" value="'+params.definition_role+'">'+params.definition_role+'</td>'+
                '</tr>');
      $(".monitorinfAddDefinition .definition_condition").mCustomScrollbar("update");
      $(".monitorinfAddDefinition .definition_condition").mCustomScrollbar("scrollTo", "bottom", {
        scrollInertia: 1500
      });
    });

    //监控信息-增加-定义-高级-删除条件
    $('.monitorinfAddDefinition .monitorinfDefintionRemoveBtn').on('click', function() {
      var select = $('.monitorinfAddDefinition .definition_condition tbody tr.active');
      if (select.length > 0) {
        select.remove();
        $(".monitorinfAddDefinition  .definition_condition").mCustomScrollbar("update");
      } else {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
      }
    });

    //监控信息-增加-定义-确定
    $('.monitorinfAddDefinition .green.button').on('click', function() {
      var operate = $('.monitorinfAddDefinition input[name="monitorinf_add_operate"]').val(),
        currentId = $('.monitorinfAddDefinition input[name="conventional_definition_id"]').val(),
        participant = {};
      $('.monitorinfAddDefinition div[data-tab="definition_one"]').find('input[name],textarea,select').each(function() {
        participant[$(this).attr('name')] = $(this).val();
      });
      $('.monitorinfAddDefinition div[data-tab="definition_two"] tbody').find('tr').each(function() {
        $(this).find('td').each(function(){
          participant[$(this).attr('name')] = participant[$(this).attr('name')] || [];
          participant[$(this).attr('name')].push($(this).attr('value'));
        });
        //以下几个属性不知道从哪里获取...???
        participant.isAppData = participant.isAppData || [];
        participant.isAppData.push('false');
        participant.condition = participant.condition || [];
        participant.condition.push('');
        participant.conditionXml = participant.conditionXml || [];
        participant.conditionXml.push('');
      });
      
      if (operate) {// 1：编辑
        thisGraph.participants.forEach(function(item, i) {
          if (item.conventional_definition_id == currentId) {
            thisGraph.participants[i] = participant;
          }
        });
      } else {// '': 保存
        thisGraph.participants.push(participant);
      }

      var rol = participant.conventional_definition_name?participant.conventional_definition_name + "-rol":participant.conventional_definition_id + "-rol";
      $('.monitorinf_add select[name="definition_role"]').dropdown('set text', rol);
      $('.monitorinf_add .dropdown .text').attr('definition_id', participant.conventional_definition_id);
    });

    //监控信息-增加/编辑-确定
    $('.monitorinf_add .green.button').on('click', function() {
      var operate = $('.monitorinf_add input[name="monitorinf_add_operate"]').val();//operate: 1为编辑
      var definition_rol = $('.monitorinf_add .dropdown .text').text(),
          definition_id = $('.monitorinf_add .dropdown .text').attr('definition_id');
      if (operate) {//编辑
        $('.monitorinf').find('tbody').find('tr.active td').text(definition_rol);
      } else {//增加
        if (!definition_rol) return;
        $('.monitorinf').find('tbody').append('<tr definition_id="'+definition_id+'"><td>'+definition_rol+'</td></tr>');
        $(".monitorinf_grid .content-div").mCustomScrollbar("update");
        var node = thisGraph.state.selectedNode;
        node.monitorinf.responsible = node.monitorinf.responsible || [];
        node.monitorinf.responsible.push(definition_id);
      }
    });

    //后置条件-条件设置-类型
    $('.targetActivity').on('change', 'select[name=conditype]', function() {
      var show_cls = '.' + $(this).val().toLowerCase() + 'Div';
      var show_div = $(this).parents('.fields').siblings(show_cls);
      var targetActivity$ = $(this).parents('.targetActivity');//为了公用模板
      if (show_div.length) {
        show_div.removeClass('hideDiv').siblings('.myitem').addClass('hideDiv');
        if (show_cls == '.conditionDiv') {//显示-条件-默认选定
          var fieldConditions_type = targetActivity$.find('.conditionDiv tbody').data('fieldConditions_type');
          if (fieldConditions_type) {
            targetActivity$.find('.conditionDiv select[name=fieldConditions_type]').parent().dropdown('set selected', fieldConditions_type);
          } else {
            targetActivity$.find('.conditionDiv select[name=fieldConditions_type]').parent().dropdown('set selected', 'AND');
          }
          targetActivity$.find('.conditionDiv select[name=fieldCondition_type]').parent().dropdown('set selected', 'AND');
          targetActivity$.find(".conditionDiv .conditionList").mCustomScrollbar("update");
        }
        if (show_cls == '.exceptionDiv') {//显示-异常-默认选定
          targetActivity$.find('.exceptionDiv select[name=condiException]:parent').dropdown('set selected', '请选择异常');
        }
        if (show_cls == '.workflowbeanDiv') {//显示-按业务对象转移-默认选定
          var fieldConditions_type2 = targetActivity$.find('.workflowbeanDiv tbody').data('fieldConditions_type');
          if (fieldConditions_type2) {
            targetActivity$.find('.workflowbeanDiv input[name=beanConditions_type]').val(fieldConditions_type2);
          } else {
            targetActivity$.find('.workflowbeanDiv input[name=beanConditions_type]').val('AND');
          }
          targetActivity$.find('.workflowbeanDiv select[name=paramField]').parent().dropdown('set selected', '0');
          targetActivity$.find('.workflowbeanDiv select[name=fieldCondition_type]').parent().dropdown('set selected', 'AND');
        }
        if (show_cls == '.userdefineDiv') {//显示-用户自定义-默认选定
          
        }
        if (show_cls == '.customDiv') {//显示-自定义转移-默认选定
          
        }
      } else {
        $(this).parents('.fields').siblings('.myitem').addClass('hideDiv');
      }
    });

    //后置条件-条件设置-类型(条件)-字段
    $('.targetActivity').on('change', '.conditionDiv select[name=key]', function() {
      var field = $(this).val(),
        conditionDiv$ = $(this).parents('.conditionDiv');
      conditionDiv$.find('input[name]').val('');
      if (field != '0') {
        var condition_sel = conditionDiv$.find('.condition_sel');
        if (field == 'nextActivityName') {
          condition_sel.dropdown('setup menu', {
              values: [
                {value: 'IN', text: '包含', name: '包含' },
                {value: 'NOT', text: '不包含', name: '不包含' }
              ]
            }).dropdown('set selected', 'IN');
        } else {
          condition_sel.dropdown('setup menu', {
              values: [
                {value: '==',  text: '=', name: '=' },
                {value: '!=', text: '!=', name: '!=' },
                {value: 'IN', text: '包含', name: '包含' },
                {value: 'NOT', text: '不包含', name: '不包含' },
                {value: 'PREFIX', text: '前缀', name: '前缀' },
                {value: 'SUFFIX', text: '后缀', name: '后缀' }
              ]
            }).dropdown('set selected', '=');
        }
      }
    });

    //后置条件-条件设置-类型(条件)-增加条件
    $('.targetActivity').on('click', '.conditionDiv .condition_addBtn', function() {
      var condition = {};
      var conditionDiv$ = $(this).parents('.conditionDiv');
      conditionDiv$.find('input[name]').each(function() {
        condition[$(this).attr('name')] = $(this).val();
      });//:not(".condition_sel")
      conditionDiv$.find('.selection').each(function() {
        var value = $(this).find('.menu .item.selected').attr('data-value');//semantic-UI setmenu 存在bug, 无法取到值
        condition[$(this).children('select').attr('name')] = value;
      });

      if (!condition.key || condition.key == '0') {
        layer.msg('请选择字段！', {time: 2000, icon: 0});
        return false;
      }
      if (!condition.displayValue_one && !condition.displayValue_two) {//存在一个参考值即可
        layer.msg('条件参数不全！', {time: 2000, icon: 0});
        return false;
      }

      var tr = thisGraph.getConditionList(condition);
      conditionDiv$.find('tbody').append(tr);
      conditionDiv$.find('input[name]').val('');
      conditionDiv$.find('.conditionList').mCustomScrollbar('update');
      conditionDiv$.find('.conditionList').mCustomScrollbar('scrollTo', 'bottom', {
        scrollInertia: 1500
      });
    });

    //后置条件-条件设置-类型-删除条件
    $('.targetActivity').on('click', '.conditionDiv .condition_removeBtn', function() {
      var conditionDiv$ = $(this).parents('.conditionDiv');
      var tr = conditionDiv$.find('tbody tr.active');
      if (tr.length) {
        tr.remove();
        conditionDiv$.find('.conditionList').mCustomScrollbar('update');
      } else {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
      }
    });

    //后置条件-条件设置-类型(按业务对象转移)-业务对象
    $('.targetActivity').on('change', '.workflowbeanDiv select[name=bean]', function() {
      var workflowbeanDiv$ = $(this).parents('.workflowbeanDiv');
      if (this.value != '0') {
        workflowbeanDiv$.find('.detailDiv').show('slow');
      } else {
        workflowbeanDiv$.find('.detailDiv').hide(1000);
      }
    });

    //后置条件-条件设置-类型(按业务对象转移)-业务对象(发送人)-方法
    $('.targetActivity').on('change', '.detailDiv select[name=key]', function() {
      var detailDiv$ = $(this).parents('.detailDiv');
      detailDiv$.find('input[name]').val('');
      if (this.value != '0') {
        var condition_sel = detailDiv$.find('.condition_sel');
        condition_sel.dropdown('setup menu', {
            values: [
              {value: '==',  text: '=', name: '=' },
              {value: '!=', text: '!=', name: '!=' },
              {value: 'IN', text: '包含', name: '包含' },
              {value: 'NOT', text: '不包含', name: '不包含' },
              {value: 'PREFIX', text: '前缀', name: '前缀' },
              {value: 'SUFFIX', text: '后缀', name: '后缀' }
            ]
          }).dropdown('set selected', '=');
      }
    });

    //后置条件-条件设置-类型(按业务对象转移)-增加条件
    $('.targetActivity').on('click', '.workflowbeanDiv .condition_addBtn', function() {
      var workflowbeanDiv$ = $(this).parents('.workflowbeanDiv');
      var bean = workflowbeanDiv$.find('select[name=bean]').val();
      if (!bean || bean == '0') {
        layer.msg('请选择业务对象！', {time: 2000, icon: 0});
        return false;
      }
      var condition = {};
      workflowbeanDiv$.find('input[name]').each(function() {
        condition[$(this).attr('name')] = $(this).val();
      });//:not(".condition_sel")
      workflowbeanDiv$.find('.selection').each(function() {
        var value = $(this).find('.menu .item.selected').attr('data-value'); //semantic-UI setmenu 存在bug, 无法取到值
        condition[$(this).children('select').attr('name')] = value;
      });

      if (!condition.key || condition.key == '0') {
        layer.msg('请选择方法！', {time: 2000, icon: 0});
        return false;
      }
      if (!condition.displayValue_one && !condition.displayValue_two) { //存在一个参考值即可
        layer.msg('条件参数不全！', {time: 2000, icon: 0});
        return false;
      }
      var num = workflowbeanDiv$.find('tbody tr').length==0? 1:parseInt($('.workflowbeanDiv tbody tr:last').find('td:first').text())+1;
      var tr = thisGraph.getConditionList(condition, num);
      workflowbeanDiv$.find('tbody').append(tr);
      workflowbeanDiv$.find('input[name^=displayValue]').val('');
      workflowbeanDiv$.find('.conditionList2').mCustomScrollbar('update');
      workflowbeanDiv$.find('.conditionList2').mCustomScrollbar('scrollTo', 'bottom', {
        scrollInertia: 1500
      });
    });

    //后置条件-条件设置-类型(按业务对象转移)-删除条件
    $('.targetActivity').on('click', '.workflowbeanDiv .condition_removeBtn', function() {
      var workflowbeanDiv$ = $(this).parents('.workflowbeanDiv');
      var tr = workflowbeanDiv$.find('tbody tr.active');
      if (tr.length) {
        tr.remove();
        workflowbeanDiv$.find('.conditionList2').mCustomScrollbar('update');
      } else {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
      }
    });

    //后置条件-条件设置-类型(按业务对象转移)-关系设置-分组
    $('.relationshipPlacement .relationshipGroup').on('click', function() {
      var names = [];
      var condition_no = $('.relationshipPlacement .condition_no').find('input[name][value=true]');
      var relationship = $('.relationshipPlacement .radio.checkbox.checked').children('input').attr('tabindex');
      if (!condition_no.length || !relationship) {
        layer.msg('请选择条件代号或关系!', {time: 2000, icon: 0});
        return false;
      }
      condition_no.each(function() {
        names.push($(this).attr('name'));
        $(this).parent('.checkbox').remove();
      });
      var beanConditions_type = '';
      names.reverse().forEach(function(item) {
        beanConditions_type += item + relationship;
      });
      beanConditions_type = '(' + beanConditions_type.replace(/(\&\&$)|(\|\|$)/, '') + ')';

      $('.relationshipPlacement input[name=beanConditions_type]').val(beanConditions_type);
      $('.relationshipPlacement .condition_no').prepend(
        '<div class="inline field">'+
        '   <div class="ui checkbox">'+
        '       <input type="checkbox" tabindex="0" class="hidden">'+
        '       <label>'+beanConditions_type+'</label>'+
        '       <input type="hidden" name="'+beanConditions_type+'" value="">'+
        '   </div>'+
        '</div>');
      $('.relationshipPlacement .condition_no .checkbox').filter(':first').checkbox({
          onChecked: function() {
            $(this).parents('.checkbox').find('input[name]').val(true);
          },
          onUnchecked: function() {
            $(this).parents('.checkbox').find('input[name]').val(false);
          }
        });

    });

    //后置条件-条件设置-类型(按业务对象转移)-关系设置-重置
    $('.relationshipPlacement .relationshipReset').on('click', function() {
      $('.relationshipPlacement input[name=beanConditions_type]').val('');

      var num = $('.workflowbeanDiv tbody tr').length;
      $('.relationshipPlacement .condition_no').empty();
      for (var i = 0; i < num; i++) {
        $('.relationshipPlacement .condition_no').append(
          '<div class="inline field">'+
          '   <div class="ui checkbox">'+
          '       <input type="checkbox" tabindex="0" class="hidden">'+
          '       <label>${'+(i+1)+'}</label>'+
          '       <input type="hidden" name="${'+(i+1)+'}" value="">'+
          '   </div>'+
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
    });

    // 后置条件-条件设置-类型(按业务对象转移)-关系设置-确定
    $('.relationshipPlacement .green.button').on('click', function() {
      var beanConditions_type = $('.relationshipPlacement input[name=beanConditions_type]').val();
      $('.workflowbeanDiv  input[name=beanConditions_type]').val(beanConditions_type);
    });

    $('.full-right').on('click', '.remove.icon', function() {
      var tab_id = $(this).parent('a').attr('data-tab');
      if (tab_id == 'tab_main') {
        layer.msg('主界面不能关闭！', {time: 2000, icon: 0, offset: '180px'});
      } else {
        $('.full-right').find('[data-tab="'+tab_id+'"]').hide();
        $('.full-right>.menu [data-tab="tab_main"]').trigger('click');
      }
    });
    

  };

  /**
   * 根据缩放比例和偏移量转换坐标
   * @param  {DOM}    svgContainer .svgContainer元素
   * @param  {Object} position     位置坐标
   * @return {Object} position     转换后的坐标
   */
  GraphCreator.prototype.parsePosition = function(svgContainer, position) {
    var transform = $(svgContainer).find('.graph').attr('transform'); // transform="translate(20,11) scale(1)"
      if (transform) {
        var result = []; // ['20,11', '1']
        var regExp_ = /\(([^)]*)\)/g;
        var ele;
        while ((ele=regExp_.exec(transform)) != null) {
           result.push(ele[1]);
        }
        var translate = result[0] && result[0].split(/,|\s/) || [0, 0]; // IE11 result[0] 为 '23.45 22.87'
        var scale = result[1] && result[1].split(',')[0] || 1;
        if (translate.length == 1 && translate[0] == 0) { // 兼容IE11
          translate.push(0);
        }
        position.x = (position.x - translate[0])/scale;
        position.y = (position.y - translate[1])/scale;
      }
      return position;
  };
/*
  GraphCreator.prototype.handleClickZoom = function() {
    var thisGraph = this;
    //放大、缩小按钮 scale(0.3-2)
    d3.selectAll('.editor-toolbar #zoom-enlarge,#zoom-narrow').on('click.zoom', function() {
      var translate = thisGraph.dragSvg.translate(),
        scale = thisGraph.dragSvg.scale(),
        extent = thisGraph.dragSvg.scaleExtent(),
        direction = 1,
        factor = 0.1;

      direction = (this.id === 'zoom-enlarge') ? 1 : -1;
      if ((scale <= extent[0] && direction < 0) || (scale >= extent[1] && direction > 0)) {
        return;
      } else {
        scale = parseFloat(scale) + factor * direction;
      }
      thisGraph.dragSvg.scale(scale)
          .translate(translate);
      thisGraph.zoomed.call(thisGraph);
    });


  };*/

  // 展示-后置条件或转移属性
  GraphCreator.prototype.showTransition = function(selector, transition) {
    var thisGraph = this;
    var postCond = transition.postCondition;
    //清空 转移信息/条件设置/事件
    $(selector).find('.tab').find('input, textarea').val('');
    $(selector).find('.tab').find('select').dropdown('clear');
    $(selector).find('tbody').empty();
    $(selector).find('.postCondi_extendedAttr').mCustomScrollbar("update");
    //转移信息
    $(selector).find('input[name=edgeId]').val(transition.edgeId);
    $(selector).find('input[name=edgeName]').val(postCond && postCond.edgeName || '');
    $(selector).find('input[name=sourceTitle]').val(transition.source.title);
    $(selector).find('input[name=targetTitle]').val(transition.target.title);
    $(selector).find('textarea[name=description]').val(postCond && postCond.description || '');
    //遍历扩展属性
    if (postCond.extendedAttrs) {
      postCond.extendedAttrs.forEach(function(item) {
        var extendedAttr = JSON.parse(item);
        var data = {name: extendedAttr.name, value: extendedAttr.value};
        data = {data: data, jsonstr: JSON.stringify(data)};
        var html = juicer($('#extended_attr_tpl').html(), data);
        $('.transferInf_extended_attr tbody').append(html).find('.ui.checkbox').checkbox();
        $(".transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar("update");
      });
    }
    //遍历条件设置-类型（条件）下列表
    if (postCond && postCond.conditype == 'CONDITION') {
      if (postCond.condixml) {//condixml base64
        var fieldConditions_obj = {fieldCondition:[]};
        var fieldConditions_str = Base64.decode(postCond.condixml);
        fieldConditions_obj.fieldConditions_type = $(fieldConditions_str).attr('type');
        $(fieldConditions_str).find('fieldCondition').each(function(fc) {
          var fieldCondition = {};
          fieldCondition.fieldCondition_type = $(this).attr('type');
          fieldCondition.key = $(this).find('expression').eq(0).attr('key');
          fieldCondition.sign_one = $(this).find('expression').eq(0).attr('sign');
          fieldCondition.type = $(this).find('expression').eq(0).attr('type');
          fieldCondition.displayValue_one = $(this).find('expression').eq(0).attr('displayValue');
          fieldCondition.sign_two = $(this).find('expression').eq(1).attr('sign');
          fieldCondition.displayValue_two = $(this).find('expression').eq(1).attr('displayValue');
          var tr = thisGraph.getConditionList(fieldCondition);
          $(selector).find('.conditionDiv tbody').append(tr);
        });
        $(selector).find('.conditionDiv tbody').data('fieldConditions_type', fieldConditions_obj.fieldConditions_type);
      }
    } else {
      $(selector).find('.conditionDiv tbody').removeData('fieldConditions_type');
    }
    //遍历条件设置-类型（按业务对象转移）下列表
    if (postCond && postCond.conditype == 'WORKFLOWBEAN') {
      if (postCond.condixml) {
        var beanConditions_obj = {beanCondition:[]};
        var beanConditions_str = Base64.decode(postCond.condixml);
        beanConditions_obj.fieldConditions_type = $(beanConditions_str).attr('type');
        $(beanConditions_str).find('beanCondition').each(function(fc) {
          var beanCondition = {};
          beanCondition.fieldCondition_type = $(this).attr('type');
          beanCondition.key = $(this).find('expression').eq(0).attr('key').split('.get')[1].replace('()', '');
          beanCondition.sign_one = $(this).find('expression').eq(0).attr('sign');
          beanCondition.type = $(this).find('expression').eq(0).attr('type');
          beanCondition.displayValue_one = $(this).find('expression').eq(0).attr('displayValue');
          beanCondition.sign_two = $(this).find('expression').eq(1).attr('sign');
          beanCondition.displayValue_two = $(this).find('expression').eq(1).attr('displayValue');
          beanCondition.bean = $(this).attr('bean').split(',')[0];
          beanCondition.paramField = $(this).attr('paramField');
          var num = $(this).attr('code');
          var tr = thisGraph.getConditionList(beanCondition, num);
          $(selector).find('.workflowbeanDiv tbody').append(tr);
        });
        $(selector).find('.workflowbeanDiv tbody').data('fieldConditions_type', beanConditions_obj.fieldConditions_type);
      }
    } else {
      $(selector).find('.workflowbeanDiv tbody').removeData('fieldConditions_type');
    }
    //条件设置 事件（标签）
    if (postCond) {
      $(selector).find('select[name=conditype]').parent().dropdown('set selected', postCond.conditype || '');
      
      $(selector).find('select[name=transitionEventType]').parent().dropdown('set selected', postCond.transitionEventType || '');
      $(selector).find('input[name=transitionEvent]').val(postCond.transitionEvent);
    }
  };

  // 更新-后置条件或转移属性
  GraphCreator.prototype.updatePostCondi = function(selector) {
    var thisGraph = this;
    var item_act = $(selector).find('.list .item.active');
    if (item_act.length || selector == '.prop_edge') {
      var edge;
      if (item_act.length) {
        var jsonObj = JSON.parse(item_act.attr('jsonStr'));
        thisGraph.edges.forEach(function(item, i) {
          if (item.edgeId == jsonObj.edgeId) {
            edge = item;
          }
        });
      } else {
        edge = thisGraph.state.selectedEdge;
      }
      var postCondition = {transitionRuleType: 'Script_Rule'};
      var $transferInf = $(selector).find('div[data-tab="four/a"]'); // 转移信息
      $transferInf.find("input:not(.hidden), select, textarea").each(function() {
        postCondition[$(this).attr('name')] = $(this).val();
      });
      postCondition.extendedAttrs = [];
      $transferInf.find('tbody tr').each(function() {
        var jsonstr = $(this).attr('jsonstr');
        postCondition.extendedAttrs.push(jsonstr);
      });
      var $conditionSet = $(selector).find('div[data-tab="four/b"]');//条件设置
      var conditype = $conditionSet.find('select[name=conditype]').val();
      postCondition.conditype = conditype;
      if (conditype == 'CONDITION') {//类型选择条件
        var tr = $(selector).find('.conditionDiv tbody').find('tr');
        var fieldCondition = '',
          condixml = '',
          fieldConditions_type = '';
        if (tr.length) {
          tr.each(function() {
            var json_obj = JSON.parse($(this).attr('jsonstr'));
            fieldCondition += 
              ' <fieldCondition type="'+json_obj.fieldCondition_type+'">'+
              '   <expression key="'+json_obj.key+'" sign="'+json_obj.sign_one+'" type="'+json_obj.type+'" displayValue="'+json_obj.displayValue_one+'"><![CDATA['+json_obj.displayValue_two+']]></expression>'+
              '   <expression key="'+json_obj.key+'" sign="'+json_obj.sign_two+'" type="'+json_obj.type+'" displayValue="'+json_obj.displayValue_two+'"><![CDATA['+json_obj.displayValue_two+']]></expression>'+
              ' </fieldCondition>';
          });
          fieldConditions_type = $(selector).find('.conditionDiv select[name=fieldConditions_type]').parent().dropdown('get value');
        }
        condixml = '<FieldConditions type="'+fieldConditions_type+'">'+ fieldCondition +'</FieldConditions>';
        condixml = Base64.encode(condixml);
        postCondition.condixml = condixml;
      }
      if (conditype == 'EXCEPTION') {//类型选择异常
        postCondition.condiException = $(selector).find('.exceptionDiv select[name=condiException]').parent().dropdown('get value');
      }
      if (conditype == 'WORKFLOWBEAN') { //类型选择业务对象转移
        var w_tr = $(selector).find('.workflowbeanDiv tbody').find('tr');
        var beanCondition = '',
          w_condixml = '',
          beanConditions_type = '';
        if (w_tr.length) {
          w_tr.each(function() {
            var json_obj = JSON.parse($(this).attr('jsonstr'));
            beanCondition += 
              '<beanCondition code="'+json_obj.code+'" type="'+json_obj.beanConditions_type+'" bean="'+json_obj.bean+'" paramField="'+json_obj.paramField+'">'+
              '  <expression key="'+json_obj.key+'" sign="'+json_obj.sign_one+'" type="'+json_obj.type+'" displayValue="'+json_obj.displayValue_one+'"><![CDATA['+json_obj.displayValue_one+']]></expression>'+
              '  <expression key="'+json_obj.key+'" sign="'+json_obj.sign_two+'" type="'+json_obj.type+'" displayValue="'+json_obj.displayValue_two+'"><![CDATA['+json_obj.displayValue_two+']]></expression>'+
              '</beanCondition>';
          });
          beanConditions_type = $(selector).find('.workflowbeanDiv input[name=beanConditions_type]').val();
        }
        w_condixml = '<beanConditions type="'+beanConditions_type+'">'+ beanCondition +'</beanConditions>';
        w_condixml = Base64.encode(w_condixml);
        postCondition.condixml = w_condixml;
      }
      if (conditype == 'USERDEFINE') {//类型选择用户自定义
        postCondition.condition_data = $(selector).find('.userdefineDiv input').val();
      }
      if (conditype == 'CUSTOM') {//类型选择自定义转移
        postCondition.condition_data = $(selector).find('.customDiv textarea').val();
      }
      var $event = $(selector).find('div[data-tab="four/c"]'); //事件（标签）
      $event.find("input[name], select").each(function() { 
        postCondition[$(this).attr('name')] = $(this).val(); 
      }); 
      edge.edgeId = postCondition.edgeId; 
      edge.postCondition = postCondition; 
      if (selector == '.post_condition') { 
        var splitType = $(selector).find('select[name=splitType]').val();
        thisGraph.state.selectedNode.postCondition = {splitType: splitType};
      }
    }
  };
  
  // 获取 后置条件-条件设置-类型(条件)下的列表
  GraphCreator.prototype.getConditionList = function(condition, num) {
    var displayCondi = {};
    var sign = condition.sign_one;
    displayCondi.sign_one = sign=='!='? '!=':sign=='=='? '=':sign=='IN'? '包含':sign=='NOT'? '不包含':sign=='PREFIX'? '前缀':sign=='SUFFIX'?'后缀':'';
    sign = condition.sign_two;
    displayCondi.sign_two = sign=='!='? '!=':sign=='=='? '=':sign=='IN'? '包含':sign=='NOT'? '不包含':sign=='PREFIX'? '前缀':sign=='SUFFIX'?'后缀':'';
    displayCondi.fieldCondition_type = condition.fieldCondition_type=='AND'? '并且':condition.fieldCondition_type=='||'? '或者':'';
    displayCondi.type = condition.key=='nextActivityName'?'External_java.util.ArrayList':'String';
    displayCondi.key = condition.key;
    displayCondi.displayValue_one = condition.displayValue_one;
    displayCondi.displayValue_two = condition.displayValue_two;
    condition.type = displayCondi.type;

    var tr = '<tr jsonstr='+JSON.stringify(condition)+'>'+
             '  <td>'+displayCondi.key+'</td>'+
             '  <td>'+displayCondi.sign_one+'</td>'+
             '  <td>'+displayCondi.displayValue_one+'</td>'+
             '  <td>'+displayCondi.fieldCondition_type+'</td>'+
             '  <td>'+displayCondi.sign_two+'</td>'+
             '  <td>'+displayCondi.displayValue_two+'</td>'+
             '  <td>'+displayCondi.type+'</td>'+
             '</tr>';
    if (condition.bean) {//类型：按业务对象转移
      displayCondi.bean = condition.bean=='System_Wf_Source_Party'? '发送人':condition.bean=='System_cre_id'?'创建人':'';
      displayCondi.paramField = condition.paramField!='0'? condition.paramField:'默认';
      displayCondi.key = condition.key=='CorpName'?'获取组织名称':condition.key=='Extattr'?'获取人员扩展属性1':condition.key=='MObilephone'?
        '获取人员移动电话号码':condition.key=='Firstname'?'获取人员姓氏':condition.key=='Gender'?'获取人员性别':condition.key=='Birthday'?
        '获取人员出生日期':condition.key=='Securitylevel'?'获取人员安全级别':condition.key=='Mainemail'?'获取人员常用EMAI':condition.key=='Lastname'?
        '获取人员名字':condition.key=='Duty'?'获取人员职务':condition.key=='Homeaddress'?'获取人员家庭住址':condition.key=='AdminLevel'?
        '获取人员级别':condition.key=='Workno'?'获取人员工号':condition.key=='Callname'?'获取人员称呼':condition.key=='Otheremail'?
        '获取人员备用EMAIL':condition.key=='Instantmessage'?'获取人员即时消息号':condition.key=='Name'?'获取人员姓名':
        condition.key=='Officeaddress'?'获取人员工作地点ID':condition.key=='Fixedphone'?'获取人员固定电话号码':'';

      // condition.bean = condition.bean + ',personInfo';
      condition.paramField = condition.paramField!='0'? condition.paramField:'';
      condition.key = 'getMetaBeanById(&apos;personInfo&apos;,'+condition.bean+').get'+condition.key+'()';
      condition.code = num;
      tr = '<tr jsonstr='+JSON.stringify(condition)+'>'+
           '  <td class="two wide">'+num+'</td>'+
           '  <td class="two wide" title='+displayCondi.bean+'>'+displayCondi.bean+'</td>'+
           '  <td class="two wide">'+displayCondi.paramField+'</td>'+
           '  <td class="two wide" title='+displayCondi.key+'>'+displayCondi.key+'</td>'+
           '  <td class="two wide">'+displayCondi.sign_one+'</td>'+
           '  <td class="two wide">'+displayCondi.displayValue_one+'</td>'+
           '  <td class="two wide">'+displayCondi.fieldCondition_type+'</td>'+
           '  <td class="two wide">'+displayCondi.sign_two+'</td>'+
           '  <td class="two wide">'+displayCondi.displayValue_two+'</td>'+
           '  <td class="two wide">'+displayCondi.type+'</td>'+
           '</tr>';
    }
    return tr;
  };

  // 获取activity的ExtendedAttributes
  GraphCreator.prototype.getExtendedAttributes = function(node, deadlineXpdl, conventionalXpdl) {
    var thisGraph = this;
    var extendAttr = node.extendAttr;
    var highLevel = node.highLevel;
    var highLevelXpdl, isCreateNew, syncType, responsible;
    if (highLevel) {
      highLevelXpdl += highLevel.activityEndEvent?'<ExtendedAttribute Name="ActivityEndEvent" Value="'+highLevel.activityEndEvent+'"/>':'';
      highLevelXpdl += highLevel.activityCreateEvent?'<ExtendedAttribute Name="ActivityCreateEvent" Value="'+highLevel.activityCreateEvent+'"/>':'';
      highLevelXpdl += highLevel.finishRule?'<ExtendedAttribute Name="FinishRule" Value="'+highLevel.finishRule+'"/>':'<ExtendedAttribute Name="FinishRule"/>';
    } else {
      highLevelXpdl = '<ExtendedAttribute Name="deadline" />';
    }
    isCreateNew = node.frontCondition.isCreateNew?'<ExtendedAttribute Name="isCreateNew" Value="'+node.frontCondition.isCreateNew+'"/>':'';
    syncType = node.frontCondition.syncType!="" && node.frontCondition.voteText?'<ExtendedAttribute Name="syncType" Value="'+node.frontCondition.syncType+'|'+node.frontCondition.voteText+'"/>':'';
    responsible = node.monitorinf.responsible?'<ExtendedAttribute Name="responsible" Value="'+
                    node.monitorinf.responsible.join(',')+'"/>':'<ExtendedAttribute Name="responsible"/>';
    var startAndEndXpdl = '';
    if (node.component == 'blockActivity' && node.activitySet.graphCreator) {
      var sub_graph = node.activitySet.graphCreator;
      var startAndEnd = thisGraph.filterStartAndEnd.call(sub_graph);
      startAndEnd.forEach(function(node) {
        switch (node.type) {
          case 'start':
            var outEdge = thisGraph.getLinkedEdges.call(sub_graph, node, 1);
            if (outEdge.length) {
              startAndEndXpdl += '<ExtendedAttribute Name="StartOfBlock" Value="none;'+outEdge[0].target.id+';'+node.x+';'+node.y+';'+outEdge[0].drawLine+'"/>';
            }
            break;
          case 'end':
            var inToEdge = thisGraph.getLinkedEdges.call(sub_graph, node, -1);
            if (inToEdge.length) {
              startAndEndXpdl += '<ExtendedAttribute Name="EndOfBlock" Value="none;'+inToEdge[0].source.id+';'+node.x+';'+node.y+';'+inToEdge[0].drawLine+'"/>';
            }
            break;
        }
      });
    }

    var ExtendedAttributes = 
            '<ExtendedAttributes>'+
                startAndEndXpdl+
                conventionalXpdl.isMulInstance+
            '   <ExtendedAttribute Name="isResponsibleTem" Value="'+node.monitorinf.isResponsibleTem+'"/>'+
                responsible+
                syncType+
                conventionalXpdl.MustActivity+
                isCreateNew+
                conventionalXpdl.taskAssignMode+
                conventionalXpdl.assignmentsOrder+
                conventionalXpdl.completeAllAssignments+
                conventionalXpdl.autoAcceptAllAssignments+
                conventionalXpdl.isResponsible+
                deadlineXpdl.deadline+
                highLevelXpdl+
            '   <ExtendedAttribute Name="warnTimeiFrequency"/>'+
                deadlineXpdl.warnTime+
                deadlineXpdl.warnAgentClassName+
                deadlineXpdl.limitAgentClassName+
                conventionalXpdl.participantID+
            '   <ExtendedAttribute Name="XOffset" Value="'+node.x+'"/>'+
            '   <ExtendedAttribute Name="YOffset" Value="'+node.y+'"/>';
    if (extendAttr) {
      extendAttr.forEach(function(ext) {
        ExtendedAttributes +=
            '   <ExtendedAttribute Name="'+JSON.parse(ext).name+'" Value="'+JSON.parse(ext).value+'"/>';
      });
    }
    ExtendedAttributes +=
            '</ExtendedAttributes>';
    return ExtendedAttributes;
  };

  //获取常规相应的xpdl
  GraphCreator.prototype.conventionalXpdl = function(node) {
    var thisGraph = this,
      conventional = node.conventional,
      conventionalXpdl = {};
    conventionalXpdl.startMode = conventional.startMode=='automatic'?'<StartMode><Automatic/></StartMode>':'<StartMode><Manual/></StartMode>';
    conventionalXpdl.finishMode = conventional.finishMode=='automatic'?'<FinishMode><Automatic/></FinishMode>':'<FinishMode><Manual/></FinishMode>';
    conventionalXpdl.isMulInstance = conventional.isMulInstance?'<ExtendedAttribute Name="isMulInstance" Value="true"/>':'<ExtendedAttribute Name="isMulInstance" Value="false"/>';
    conventionalXpdl.isResponsible = '<ExtendedAttribute Name="isResponsible" Value="'+conventional.isResponsible+'"/>';
    conventionalXpdl.autoAcceptAllAssignments = '<ExtendedAttribute Name="autoAcceptAllAssignments" Value="'+conventional.autoAcceptAllAssignments+'"/>';   
    conventionalXpdl.completeAllAssignments = conventional.completeAllAssignments?'<ExtendedAttribute Name="completeAllAssignments" Value="true"/>':'<ExtendedAttribute Name="completeAllAssignments" Value="false"/>';
    conventionalXpdl.assignmentsOrder = conventional.assignmentsOrder?'<ExtendedAttribute Name="assignmentsOrder" Value="true"/>':'<ExtendedAttribute Name="assignmentsOrder" Value="false"/>';
    conventionalXpdl.description = conventional.description?'<Description>'+conventional.description+'</Description>':'';
    conventionalXpdl.taskAssignMode = '<ExtendedAttribute Name="taskAssignMode" Value="'+conventional.taskAssign+'"/>';
    conventionalXpdl.MustActivity = '<ExtendedAttribute Name="MustActivity" Value="'+conventional.MustActivity+'"/>';
    conventionalXpdl.participantID = conventional.participantID?'<ExtendedAttribute Name="ParticipantID" Value="'+conventional.participantID+'"/>':'<ExtendedAttribute Name="ParticipantID"/>';
    conventionalXpdl.performer = conventional.performer?'<Performer>'+conventional.performer+'</Performer>':'';
    return conventionalXpdl;
  };

  //获取超时限制相应的xpdl 
  GraphCreator.prototype.deadlineXpdl = function(node) {
    var thisGraph = this,
      timeoutLimit = node.timeoutLimit,
      deadlineXpdl = {};
    deadlineXpdl.limit = timeoutLimit.limitTime?'<Limit>'+timeoutLimit.limitTime+'</Limit>':'';
    deadlineXpdl.warnTime = timeoutLimit.warnTime?'<ExtendedAttribute Name="warnTime" Value="'+timeoutLimit.warnTime+'"/>':'<ExtendedAttribute Name="warnTime"/>';
    deadlineXpdl.warnAgentClassName = timeoutLimit.warnAgentClassName?'<ExtendedAttribute Name="warnAgentClassName" Value="'+timeoutLimit.warnAgentClassName+'"/>':'<ExtendedAttribute Name="warnAgentClassName"/>';
    deadlineXpdl.limitAgentClassName = timeoutLimit.limitAgentClassName?'<ExtendedAttribute Name="LimitAgentClassName" Value="'+timeoutLimit.limitAgentClassName+'"/>':'<ExtendedAttribute Name="LimitAgentClassName"/>';
    var Deadlines = '',
      deadlines_arr = [];
    if (timeoutLimit.deadline) {
      timeoutLimit.deadline.forEach(function(dl, i) {
        var deadline = JSON.parse(dl);
        deadlines_arr.push(deadline.exceptionName+','+deadline.deadlineCondition);
        if (deadline.execution == '') {
          Deadlines += '<Deadline>' +
                       '    <DeadlineCondition>'+deadline.deadlineCondition+'</DeadlineCondition>' +
                       '    <ExceptionName>'+deadline.exceptionName+'</ExceptionName>' +
                       '</Deadline>';
        }
        if (deadline.execution == 'SYNCHR') {
          Deadlines += '<Deadline Execution="SYNCHR">' +
                       '    <DeadlineCondition>'+deadline.deadlineCondition+'</DeadlineCondition>' +
                       '    <ExceptionName>'+deadline.exceptionName+'</ExceptionName>' +
                       '</Deadline>';
        }
        if (deadline.execution == 'ASYNCHR') {
          Deadlines += '<Deadline Execution="ASYNCHR">' +
                       '    <DeadlineCondition>'+deadline.deadlineCondition+'</DeadlineCondition>' +
                       '    <ExceptionName>'+deadline.exceptionName+'</ExceptionName>' +
                       '</Deadline>';
        }
      });
    }
    deadlineXpdl.deadlines = Deadlines;
    deadlineXpdl.deadline = deadlines_arr.length>0? '<ExtendedAttribute Name="deadline" Value="'+deadlines_arr.join('|')+'"/>':'<ExtendedAttribute Name="deadline"/>';
    return deadlineXpdl;
  };

  //获取activity进出线的数量
  GraphCreator.prototype.activityInOutNum = function(node) {
    var thisGraph = this;
    var numIn = 0,
      numOut = 0,
      transitionRefs = '',
      activity_inOut = {};
    
    thisGraph.edges.forEach(function(edge) {
      var source = edge.source.component;
      var target = edge.target.component;
      if ( source != "startComponent" && target != "endComponent") {
        if (edge.source == node) {
          numOut++;
          transitionRefs += '<TransitionRef Id="'+edge.edgeId+'"/>';
        } else if (edge.target == node) {
          numIn++;
        }
      }
    });
    activity_inOut.numIn = numIn;
    activity_inOut.numOut = numOut;
    activity_inOut.transitionRefs = transitionRefs;
    return activity_inOut;
  };

  //获取TransitionRestrictions相应的xpdl
  GraphCreator.prototype.getTransitionRestrictions = function(node, activity_inOut) {
    var join = node.frontCondition.convergeType?'<Join Type="'+node.frontCondition.convergeType+'"/>':'<Join Type="XOR"/>';
    var TransitionRestrictions = '';
    if (activity_inOut.numIn > 1 || activity_inOut.numOut > 1 || node.frontCondition.convergeType) {
      TransitionRestrictions += '<TransitionRestrictions>'+
                                '    <TransitionRestriction>';
      if (activity_inOut.numIn > 1 || node.frontCondition.convergeType) {  
        TransitionRestrictions +=      join;
      }
      if (activity_inOut.numOut > 1) {
        TransitionRestrictions += '    <Split Type="XOR">' +
                                  '        <TransitionRefs>' +
                                               activity_inOut.transitionRefs +
                                  '        </TransitionRefs>' +
                                  '    </Split>';
      }
      TransitionRestrictions += '    </TransitionRestriction>'+
                                '</TransitionRestrictions>';
    }
    return TransitionRestrictions;
  };

  //生成参与者相应的xpdl
  GraphCreator.prototype.getParticipants = function() { //??细节还有问题：1.isAppData; 2.condition,conditionXml;
    var thisGraph = this;
    if (thisGraph.participants.length == 0) return '';

    var xpdl = '',
      participantsXpdl = '';

    thisGraph.participants.forEach(function(p) {
      var extendedAttr = '',
        description = p.conventional_definition_description? '<Description>'+p.conventional_definition_description+'</Description>':'',
        p_name = p.conventional_definition_name?' Name="'+p.conventional_definition_name+'"':'';
      if (p && p.conventional_definition_participant) {
        extendedAttr  = '<ExtendedAttribute Name="PartyBeanId" Value="'+p.conventional_definition_participant+'"/>';
      } else {
        extendedAttr += '<ExtendedAttribute Name="typeName" Value="'+(p.typeName?p.typeName.join(','):"")+'"/>'+
                        '<ExtendedAttribute Name="isAppData" Value="'+(p.isAppData?p.isAppData.join(','):"")+'"/>'+
                        '<ExtendedAttribute Name="itemName" Value="'+(p.itemName?p.itemName.join(','):"")+'"/>'+
                        '<ExtendedAttribute Name="itemValue" Value="'+(p.itemValue?p.itemValue.join(','):"")+'"/>'+
                        '<ExtendedAttribute Name="secLevelS" Value="'+(p.secLevelS?p.secLevelS.join(','):"")+'"/>'+
                        '<ExtendedAttribute Name="secLevelE" Value="'+(p.secLevelE?p.secLevelE.join(','):"")+'"/>'+
                        '<ExtendedAttribute Name="condition"><![CDATA['+p.condition.join(',')+']]></ExtendedAttribute>'+
                        '<ExtendedAttribute Name="conditionXml"><![CDATA['+p.conditionXml.join(',')+']]></ExtendedAttribute>'+
                        '<ExtendedAttribute Name="roleName" Value="'+(p.roleName?p.roleName.join(','):"")+'"/>';
      }
      participantsXpdl += '<Participant Id="'+p.conventional_definition_id+'"'+p_name+'>'+
                          '    <ParticipantType Type="ROLE"/>'+
                               description+
                          '    <ExtendedAttributes>'+
                                  extendedAttr+
                          '    </ExtendedAttributes>'+
                          '</Participant>';
    });
    xpdl += '<Participants>'+
               participantsXpdl+
           '</Participants>';
    return xpdl;
  };

  //生成所有activity xml添加至xmlContainer
  GraphCreator.prototype.emergeAllXmlContent = function() {
    var thisGraph = this;
    var start = '<WorkflowProcess Id="'+workflow_id+'" Name="'+workflow_name+'" endform-id="" endformschema="">',
          end = '  <text-limit/>'+
                '</WorkflowProcess>';

    var curText = start,
      activity = '';
    thisGraph.nodes.forEach(function(node) {
      if (node.type == 'activity') {
        activity = '<activity Id="'+node.id+'" Name="'+node.title+'" form-id="" formdisplayschema="" hisformdisplayschema="">'+
                   '  <operations/>'+
                   '  <text-limit/>'+
                   '</activity>';
        curText += activity;
      }
    });
    curText += end;
    curText = vkbeautify.xml(curText);
    return curText;
  };

  GraphCreator.prototype.startAndEndOfWorkflow = function() {
    var thisGraph = this;
    var edges = thisGraph.edges;
    var nodes_start = '',
      nodes_end = '';
    thisGraph.nodes.forEach(function(node) {
        switch (node.type) {
          case 'start':
            edges.forEach(function(edge) {
              if (edge.source == node) {
                nodes_start += '<ExtendedAttribute Name="StartOfWorkflow" Value="none;'+edge.target.id+';'+node.x+';'+node.y+';'+edge.drawLine+'"/>';
              }
            });
            break;
          case 'end':
            edges.forEach(function(edge) {
              if (edge.target == node) {
                nodes_end += '<ExtendedAttribute Name="EndOfWorkflow" Value="none;'+edge.source.id+';'+node.x+';'+node.y+';'+edge.drawLine +'"/>';
              }
            });
            break;
        }
    });
    return  {
              start: nodes_start,
              end: nodes_end
            };

  };

  GraphCreator.prototype.emergeActivities = function() {
    var thisGraph = this;
    var activitiesXpdl = '';

    var activities = thisGraph.filterActivities();
    if (!activities.length) return activitiesXpdl;
    
    activities.forEach(function(node) {
      var activity_inOut = thisGraph.activityInOutNum(node);
      var deadlineXpdl = thisGraph.deadlineXpdl(node);
      var conventionalXpdl = thisGraph.conventionalXpdl(node);
      switch (node.component) {
        case "ordinaryActivity": //普通活动
          activitiesXpdl += '<Activity Id="'+node.id+'" Name="'+node.title+'">'+
                                 deadlineXpdl.limit+
                                 conventionalXpdl.description+
                            '    <Implementation>'+
                            '        <No/>'+
                            '    </Implementation>'+
                                 conventionalXpdl.performer+
                                 conventionalXpdl.startMode+
                                 conventionalXpdl.finishMode+
                            '    <Priority/>'+
                                 deadlineXpdl.deadlines+
                                 thisGraph.getTransitionRestrictions(node, activity_inOut)+
                                 thisGraph.getExtendedAttributes(node, deadlineXpdl, conventionalXpdl)+
                            '</Activity>';
          break;
        case "blockActivity": //块活动
          activitiesXpdl += '<Activity Id="'+node.id+'" Name="'+node.title+'">' +
                                 deadlineXpdl.limit +
                                 conventionalXpdl.description +
                            '    <BlockActivity BlockId="Package_H00387DJ_Wor1_Ase2"/>' +
                                 conventionalXpdl.performer +
                                 conventionalXpdl.startMode +
                                 conventionalXpdl.finishMode +
                            '    <Priority/>' +
                                 deadlineXpdl.deadlines +
                                 thisGraph.getTransitionRestrictions(node, activity_inOut) +
                                 thisGraph.getExtendedAttributes(node, deadlineXpdl, conventionalXpdl) +
                            '</Activity>';   
          break;
        case "subFlowActivity": //子活动
          activitiesXpdl += '<Activity Id="'+node.id+'" Name="'+node.title+'">' +
                                 deadlineXpdl.limit +
                                 conventionalXpdl.description +
                            '    <Implementation>' +
                            '        <SubFlow Execution="SYNCHR" Id="Package_6MT7F8C0_Wor4"/>' + //subFlowId是什么东西?? 
                            '    </Implementation>' +
                                 conventionalXpdl.performer +
                                 conventionalXpdl.startMode +
                                 conventionalXpdl.finishMode +
                            '    <Priority/>' +
                                 deadlineXpdl.deadlines +
                                 thisGraph.getTransitionRestrictions(node, activity_inOut) +
                                 thisGraph.getExtendedAttributes(node, deadlineXpdl, conventionalXpdl) +
                            '</Activity>';
          break;
        case "routeActivity": //路径活动
          activitiesXpdl += '<Activity Id="'+node.id+'" Name="'+node.title+'">' +
                                 deadlineXpdl.limit +
                                 conventionalXpdl.description +
                            '    <Route/>' +
                                 conventionalXpdl.performer +
                                 conventionalXpdl.startMode +
                                 conventionalXpdl.finishMode +
                            '    <Priority/>' +
                                 deadlineXpdl.deadlines +
                                 thisGraph.getTransitionRestrictions(node, activity_inOut) +
                                 thisGraph.getExtendedAttributes(node, deadlineXpdl, conventionalXpdl) +
                            '</Activity>';
          break;
        }
    });
    return '<Activities>' + activitiesXpdl + '</Activities>';
  };

  GraphCreator.prototype.emergeTransitions = function() {
    var thisGraph = this;
    var transitions = '';
    var edges_act = thisGraph.edgesLinkAcivity();
    if (!edges_act.length) return transitions;

    edges_act.forEach(function(edge) {
      var p = edge.postCondition;
      var description = p.description? '<Description>'+p.description+'</Description>':'';
      var extendedAttrsXpdl = '';
      if (p.extendedAttrs) {
        p.extendedAttrs.forEach(function(item) {
          var extendedAttr = JSON.parse(item);
          extendedAttrsXpdl += '<ExtendedAttribute Name="'+extendedAttr.name+'" Value="'+extendedAttr.value+'"/>';
        });
      }
      var transitionRuleType = p.transitionRuleType? '<ExtendedAttribute Name="TransitionRuleType" Value="'+p.transitionRuleType+'"/>':'<ExtendedAttribute Name="TransitionRuleType"/>';
      var transitionEventXpdl = p.transitionEvent? '<ExtendedAttribute Name="TransitionEvent"><![CDATA['+p.transitionEvent+']]></ExtendedAttribute>':'';
      var conditype = p.conditype || '';
      var conditypeXpdl = conditype? '<ExtendedAttribute Name="conditype" Value="'+conditype+'"/>':'<ExtendedAttribute Name="conditype"/>';
      var condixml = p.condixml || '';
      var condixmlXpdl = condixml? '<ExtendedAttribute Name="condixml" Value="'+condixml+'"/>':'';
      var condition = '',
        condiException = '',
        content = '';
      if (conditype == 'WORKFLOWBEAN' || conditype == 'CONDITION') { // 条件、按业务对象转移
        var selector;
        if (conditype == 'WORKFLOWBEAN') {
          selector = 'beanCondition';
        } else { 
          selector = 'fieldCondition';
        }
        var beanConditions = Base64.decode(p.condixml);
        var beanCons_type = $(beanConditions).attr('type') == 'AND'? '&&': $(beanConditions).attr('type'); // ((${1}&&${2})||${3}) 
        var beans = '';
        $(beanConditions).find(selector).each(function() {
          var beanCon_type = $(this).attr('type') == 'AND'? '&&': '||';
          var exps = '';
          $(this).find('expression').each(function() { 
            // 业务对象：发送人；            参数字段：默认；| 方法：获得组织名称；    |  条件：=；   |  参考值：1
            // bean: System_Wf_Source_Party  paramField: 0   | key: CorpName           |  sign_one: = |  displayValue_one: 1
            //                                               | 关系：并且；            |  条件：！=； |  参考值：2
            //                                               | fieldCondition_type: AND|  sign_two: !=|  displayValue_two: 2
            /* ==> 
            (( 
              typeof(getMetaBeanById('personInfo',System_Wf_Source_Party).getCorpName())!='undefined' && 
              getMetaBeanById('personInfo',System_Wf_Source_Party).getCorpName()!=null && 
              getMetaBeanById('personInfo',System_Wf_Source_Party).getCorpName()=='1' 
            )) && (( 
              typeof(getMetaBeanById('personInfo',System_Wf_Source_Party).getCorpName())!='undefined' && 
              getMetaBeanById('personInfo',System_Wf_Source_Party).getCorpName()!=null && 
              getMetaBeanById('personInfo',System_Wf_Source_Party).getCorpName()!='2' 
            ))*/ 
            var exp_cdata = $(wfdConfig).find('expression[key="'+$(this).attr('sign')+'"] exp[type="'+$(this).attr('type')+'"]').eq(0).html();// <![CDATA[(typeof(${b})!='undefined' && ${b}!=null && ${b}=='${a}')]]>
            exp_cdata = exp_cdata.replace(/<!\[CDATA\[(.+)\]\]>/, function(match, p1) { 
              return p1;
            });
            var exp = exp_cdata.replace(/\$\{a\}/g, $(this).attr('displayValue'));
            exp = exp.replace(/\$\{b\}/g, $(this).attr('key'));
            exps += '('+exp+')'+beanCon_type;
          });
          exps = exps.replace(/(&&|\|\|)$/, '');
          // beans += '(' + exps + ')' + beanCons_type;
          if (beanCons_type == '&&' || beanCons_type == '||') {
            beans += '(' + exps + ')' + beanCons_type;
          } else {
            var reg = new RegExp('\\$\\{'+$(this).attr('code')+'\\}');
            beans = beans? beans.replace(reg, '(' + exps + ')') : beanCons_type.replace(reg, '(' + exps + ')');
          }
        });
        beans =  beans.replace(/(&&|\|\|)$/, '');

        condition = '<Condition Type="CONDITION"><![CDATA[('+beans+')]]></Condition>';
      } else if (conditype == 'TACHE') { // 环节名称转移
        var exp = $(wfdConfig).find('exp[type=nextActivityName]').html();
        content = exp.replace(/\$\{a\}/, edge.target.id);
        condition = '<Condition Type="CONDITION">'+content+'</Condition>';
      } else if (conditype == 'USERDEFINE' || conditype == 'CUSTOM') { // 用户自定义、自定义转移
        condition = p.condition_data? '<Condition Type="CONDITION"><![CDATA[('+p.condition_data+')]]></Condition>':'';
      } else if (conditype) { // 缺省异常
        condition = '<Condition Type="'+conditype+'"/>';
      } else { // 其他、异常
        condition = '<Condition/>';
      }
      if (conditype == 'EXCEPTION') {
        condiException = p.condiException? '<ExtendedAttribute Name="condiException" Value="'+p.condiException+'"/>':'';
      }
      transitions +=  '<Transition From="'+edge.source.id+'" Id="'+edge.edgeId+'" '+(p.edgeName? 'Name="'+p.edgeName+'"':'')+' To="'+edge.target.id+'">' +
                          condition +
                          description +
                      '   <ExtendedAttributes>' +
                              condiException +
                              condixmlXpdl +
                              transitionRuleType +
                              transitionEventXpdl +
                      '       <ExtendedAttribute Name="TransitionEventType" Value="'+p.transitionEventType+'"/>' +
                              conditypeXpdl +
                      '       <ExtendedAttribute Name="RoutingType" Value="'+edge.drawLine+'"/>' +
                              extendedAttrsXpdl +
                      '    </ExtendedAttributes>' +
                      '</Transition>';
    });

    return '<Transitions>' + transitions + '</Transitions>';
  };

  //生成所有activity xml添加至xpdlContainer
  GraphCreator.prototype.emergeAllxpdlContent = function() {
    var thisGraph = this;
    var blockActivities = thisGraph.filterBlockActivities();
    var activitySets = '';
    if (blockActivities.length) {
      blockActivities.forEach(function(blockActivity) {
        var activitySetId = blockActivity.activitySet.activitySetId;
        var graph = blockActivity.activitySet.graphCreator;
        if (graph) {
          activitySets += graph.emergeActivitySet(activitySetId);
        } else {
          activitySets += '<ActivitySet Id="'+activitySetId+'"></ActivitySet>';
        }

      });
      activitySets = '<ActivitySets>' + activitySets + '</ActivitySets>';
    }
    
    var xpdl = '<WorkflowProcesses>' +
              '   <WorkflowProcess AccessLevel="PUBLIC" Id="'+workflow_id+'" Name="'+workflow_name+'">' +
              '       <ProcessHeader DurationUnit="D">' +
              '           <Created>'+create_time+'</Created>' +
              '           <Priority/>' +
              '       </ProcessHeader>' +
              '       <RedefinableHeader PublicationStatus="UNDER_TEST">' +
              '           <Author>管理员</Author>' +
              '           <Version>1.0</Version>' +
              '       </RedefinableHeader>' +
                      thisGraph.getParticipants() +
              '       <Applications>' +
              '           <Application Id="workflow_DefaultToolAgent" Name="执行其他的toolagent">' +
              '               <Description>执行其他的toolagent</Description>' +
              '               <FormalParameters>' +
              '                   <FormalParameter Id="ToolAgentClass" Index="0" Mode="IN">' +
              '                       <DataType>' +
              '                           <ExternalReference location="java.lang.String"/>' +
              '                       </DataType>' +
              '                       <Description>其他组件名称</Description>' +
              '                   </FormalParameter>' +
              '               </FormalParameters>' +
              '               <ExtendedAttributes>' +
              '                   <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.DefaultToolAgent"/>' +
              '                   <ExtendedAttribute Name="ToolAgentClass"/>' +
              '               </ExtendedAttributes>' +
              '           </Application>' +
              '           <Application Id="workflow_sendMailToolAgent" Name="发送邮件">' +
              '               <Description>发送电子邮件</Description>' +
              '               <FormalParameters>' +
              '                   <FormalParameter Id="body" Index="body" Mode="IN">' +
              '                       <DataType>' +
              '                           <BasicType Type="STRING"/>' +
              '                       </DataType>' +
              '                       <Description>邮件正文</Description>' +
              '                   </FormalParameter>' +
              '                   <FormalParameter Id="subject" Index="subject" Mode="IN">' +
              '                       <DataType>' +
              '                           <BasicType Type="STRING"/>' +
              '                       </DataType>' +
              '                       <Description>邮件标题</Description>' +
              '                   </FormalParameter>' +
              '                   <FormalParameter Id="to" Index="to" Mode="IN">' +
              '                       <DataType>' +
              '                           <BasicType Type="STRING"/>' +
              '                       </DataType>' +
              '                       <Description>邮件地址,多个使用 , 分割</Description>' +
              '                   </FormalParameter>' +
              '               </FormalParameters>' +
              '               <ExtendedAttributes>' +
              '                   <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.sendMailToolAgent"/>' +
              '               </ExtendedAttributes>' +
              '           </Application>' +
              '           <Application Id="workflow_dbToolAgent" Name="修改数据">' +
              '               <Description>修改数据库数据</Description>' +
              '               <FormalParameters>' +
              '                   <FormalParameter Id="tableName" Index="0" Mode="IN">' +
              '                       <DataType>' +
              '                           <ExternalReference location="java.lang.String"/>' +
              '                       </DataType>' +
              '                       <Description>数据表名称</Description>' +
              '                   </FormalParameter>' +
              '                   <FormalParameter Id="dbdata" Index="1" Mode="IN">' +
              '                       <DataType>' +
              '                           <ExternalReference location="java.lang.Object"/>' +
              '                       </DataType>' +
              '                       <Description>需要操作的数据可以是一个String,pojo或者Map</Description>' +
              '                   </FormalParameter>' +
              '                   <FormalParameter Id="DbActionType" Index="2" Mode="IN">' +
              '                       <DataType>' +
              '                           <BasicType Type="INTEGER"/>' +
              '                       </DataType>' +
              '                       <Description>对数据库的操作类型，取值：1 增加 2 修改 3 删除</Description>' +
              '                   </FormalParameter>' +
              '                   <FormalParameter Id="Condition" Index="3" Mode="IN">' +
              '                       <DataType>' +
              '                           <ExternalReference location="java.lang.Object"/>' +
              '                       </DataType>' +
              '                       <Description>数据操作条件，可以为pojo或者Map,为数据的操作条件</Description>' +
              '                   </FormalParameter>' +
              '               </FormalParameters>' +
              '               <ExtendedAttributes>' +
              '                   <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.dbToolAgent"/>' +
              '                   <ExtendedAttribute Name="DataTableName"/>' +
              '               </ExtendedAttributes>' +
              '           </Application>' +
              '           <Application Id="workflow_fetchDataAgent" Name="获取数据">' +
              '               <Description>获取数据库数据</Description>' +
              '               <FormalParameters>' +
              '                   <FormalParameter Id="Condition" Index="1" Mode="IN">' +
              '                       <DataType>' +
              '                           <ExternalReference location="java.lang.Object"/>' +
              '                       </DataType>' +
              '                       <Description>数据操作条件，可以为pojo或者Map,为数据的操作条件</Description>' +
              '                   </FormalParameter>' +
              '               </FormalParameters>' +
              '               <ExtendedAttributes>' +
              '                   <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.fetchDataAgent"/>' +
              '                   <ExtendedAttribute Name="DataTableName"/>' +
              '               </ExtendedAttributes>' +
              '           </Application>' +
              '       </Applications>';
    
    xpdl +=  activitySets +
             thisGraph.emergeActivities() +
             thisGraph.emergeTransitions() +
             '       <ExtendedAttributes>' +
             '           <ExtendedAttribute Name="IsMain" Value="true"/>' +
             '           <ExtendedAttribute Name="warnTimeiFrequency"/>' +
             '           <ExtendedAttribute Name="warnTime"/>' +
             '           <ExtendedAttribute Name="warnAgentClassName"/>' +
             '           <ExtendedAttribute Name="LimitAgentClassName"/>' +
             '           <ExtendedAttribute Name="initFormPlugin" Value="wfd_self.xml"/>' +
             '           <ExtendedAttribute Name="initReserve"/>' +
             '           <ExtendedAttribute Name="initType" Value="money"/>' +
             '           <ExtendedAttribute Name="initAuthor" Value="管理员"/>' +
                         thisGraph.startAndEndOfWorkflow().start +
                         thisGraph.startAndEndOfWorkflow().end +
             '       </ExtendedAttributes>' +
             '   </WorkflowProcess>' +
             '</WorkflowProcesses>';
    return vkbeautify.xml(xpdl);
  };

  GraphCreator.prototype.emergeActivitySet = function(activitySetId) {
    var thisGraph = this; 
    var activities = thisGraph.filterActivities();
    var activitySets = '<ActivitySet Id="'+activitySetId+'"></ActivitySet>';
    if (activities.length) {
      activitySets = '<ActivitySet Id="'+activitySetId+'">' + 
                         thisGraph.emergeActivities() + 
                         thisGraph.emergeTransitions() + 
                     '</ActivitySet>';
    }
    return activitySets;
  };

  GraphCreator.prototype.findActByActSetId = function(activitysetid) {
    var thisGraph = this;
    var blockActivity = thisGraph.nodes.find(function(node) {
      return node.component == 'blockActivity' && node.activitySet.activitySetId == activitysetid;
    });
    return blockActivity;
  };

  GraphCreator.prototype.filterActivities = function() {
    var thisGraph = this;
    var activities = thisGraph.nodes.filter(function(node) {
      return node.type == 'activity';
    });
    return activities;
  };

  GraphCreator.prototype.filterStartAndEnd = function() {
    var thisGraph = this;
    var activities = thisGraph.nodes.filter(function (node) {
      return node.type == 'start' || node.type == 'end';
    });
    return activities;
  };

  GraphCreator.prototype.filterBlockActivities = function() {
    var thisGraph = this;
    var blockActivities = thisGraph.nodes.filter(function(node) {
      return node.component == 'blockActivity';
    });
    return blockActivities;
  };

  GraphCreator.prototype.edgesLinkAcivity = function() {
    var thisGraph = this;
    var edges_act = thisGraph.edges.filter(function(edge) {
      return (edge.source.type != 'start' && edge.target.type != 'end');
    });
    return edges_act;
  };

  GraphCreator.prototype.consts = {
    selectedClass: "selected",
    connectClass: "connect-node",
    circleGClass: "conceptG",
    graphClass: "graph",
    activeEditId: "active-editing",
    BACKSPACE_KEY: 8,
    DELETE_KEY: 46,
    ENTER_KEY: 13,
    nodeRadius: 34,
    nodeRadiusVary: 1
  };

  /**
   * 获取link样式 [添加线样式 start:连线起点 des:连线终点]
   * 如果 |dif.x| > |dif.y| 左右连线，反之，上下连线
   * 如果 dif.x > 0 && dif.y < 0 第四象限
   * 如果 dif.x > 0 && dif.y > 0 第一象限
   * 如果 dif.x < 0 && dif.y > 0 第二象限
   * 如果 dif.x < 0 && dif.y < 0 第三象限
   */
  GraphCreator.prototype.getLink_d = function(start, des) {
    var d = start;
    var mid_x = (d.x + des.x)/2,
      mid_y = (d.y + des.y)/2;
    var dif_x = des.x - d.x,
      dif_y = des.y - d.y;
    var link;
    if (Math.abs(dif_x) > Math.abs(dif_y)) { // 左右连线
      if (dif_x > 0 && dif_y > 0) { //第一象限（200,200-300,300）
        // <path d="M 200,200 L 245,200 M 245,200 A 5,5,0,0,1 250,205 M 250,205 L 250,295 M 250,295 A 5,5,0,0,0 255,300 M 255,300 L 300,300" fill="none" stroke="#F18C16" stroke-width="1"></path>
        link = 'M' + d.x + ',' + d.y + 'L' + (mid_x-5) + ',' + d.y + 'M' + (mid_x-5) + ',' + d.y + 'A 5,5,0,0,1 ' + mid_x + ',' + (d.y+5) + 
          'M' + mid_x + ',' + (d.y+5) + 'L' + mid_x + ',' + (des.y-5) +'M' + mid_x + ',' + (des.y-5) + 'A 5,5,0,0,0' + (mid_x+5) + ',' + des.y + 
          'M' + (mid_x+5) + ',' + des.y + 'L' + des.x + ',' + des.y;
      }
      if (dif_x < 0 && dif_y > 0) { //第二象限（200,200-100,300）
        // <path d="M 200,200 L 155,200 M 155,200 A 5,5,0,0,0 150,205 M 150,205 L 150,295 M 150,295 A 5,5,0,0,1 145,300 M 145,300 L 100,300" fill="none" stroke="#F18C16" stroke-width="1"></path> 
        link = 'M' + d.x + ',' + d.y + 'L' + (mid_x+5) + ',' + d.y + 'M' + (mid_x+5) + ',' + d.y + 'A 5,5,0,0,0 ' + mid_x + ',' + (d.y+5) + 
          'M' + mid_x + ',' + (d.y+5) + 'L' + mid_x + ',' + (des.y-5) +'M' + mid_x + ',' + (des.y-5) + 'A 5,5,0,0,1' + (mid_x-5) + ',' + des.y + 
          'M' + (mid_x-5) + ',' + des.y + 'L' + des.x + ',' + des.y;
      }
      if (dif_x < 0 && dif_y < 0) { //第三象限（200,200-100,100）
        // <path d="M 200,200 L 155,200 M 155,200 A 5,5,0,0,1 150,195 M 150,195 L 150,105 M 150,105 A 5,5,0,0,0 145,100 M 145,100 L 100,100" fill="none" stroke="#F18C16" stroke-width="1"></path>
        link = 'M' + d.x + ',' + d.y + 'L' + (mid_x+5) + ',' + d.y + 'M' + (mid_x+5) + ',' + d.y + 'A 5,5,0,0,1 ' + mid_x + ',' + (d.y-5) + 
          'M' + mid_x + ',' + (d.y-5) + 'L' + mid_x + ',' + (des.y+5) +'M' + mid_x + ',' + (des.y+5) + 'A 5,5,0,0,0' + (mid_x-5) + ',' + des.y + 
          'M' + (mid_x-5) + ',' + des.y + 'L' + des.x + ',' + des.y;
      }
      if (dif_x > 0 && dif_y < 0) { //第四象限（200,200-300,100）
        // <path d="M 200,200 L 245,200 M 245,200 A 5,5,0,0,0 250,195 M 250,195 L 250,105 M 250,105 A 5,5,0,0,1 255,100 M 255,100 L 300,100" fill="none" stroke="#F18C16" stroke-width="1"></path>
        link = 'M' + d.x + ',' + d.y + 'L' + (mid_x-5) + ',' + d.y + 'M' + (mid_x-5) + ',' + d.y + 'A 5,5,0,0,0 ' + mid_x + ',' + (d.y-5) + 
          'M' + mid_x + ',' + (d.y-5) + 'L' + mid_x + ',' + (des.y+5) +'M' + mid_x + ',' + (des.y+5) + 'A 5,5,0,0,1' + (mid_x+5) + ',' + des.y + 
          'M' + (mid_x+5) + ',' + des.y + 'L' + des.x + ',' + des.y;
      }
    } else { // 上下连线
      if (dif_x > 0 && dif_y > 0) { //第一象限（200,200-300,300）
        // <path d="M 100,100 L 100,145 M 100,145 A 5,5,0,0,0 105,150 M 105,150 L 195,150 M 195,150 A 5,5,0,0,1 200,155 M 200,155 L 200,200" fill="none" stroke="#0096f2" stroke-width="1"></path>
        link = 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + (mid_y-5) + 'M' + d.x + ',' + (mid_y-5) + 'A 5,5,0,0,0 ' + (d.x+5) + ',' + mid_y + 
          'M' + (d.x+5) + ',' + mid_y + 'L' + (des.x-5) + ',' + mid_y +'M' + (des.x-5) + ',' + mid_y + 'A 5,5,0,0,1' + des.x + ',' + (mid_y+5) + 
          'M' + des.x + ',' + (mid_y+5) + 'L' + des.x + ',' + des.y;
      }
      if (dif_x < 0 && dif_y > 0) { //第二象限（200,200-100,300）
        // <path d="M 200,200 L 200,245 M 200,245 A 5,5,0,0,1 195,250 M 195,250 L 105,250 M 105,250 A 5,5,0,0,0 100,255 M 100,255 L 100,300" fill="none" stroke="#0096f2" stroke-width="1"></path>
        link = 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + (mid_y-5) + 'M' + d.x + ',' + (mid_y-5) + 'A 5,5,0,0,1 ' + (d.x-5) + ',' + mid_y + 
          'M' + (d.x-5) + ',' + mid_y + 'L' + (des.x+5) + ',' + mid_y +'M' + (des.x+5) + ',' + mid_y + 'A 5,5,0,0,0' + des.x + ',' + (mid_y+5) + 
          'M' + des.x + ',' + (mid_y+5) + 'L' + des.x + ',' + des.y;
      }
      if (dif_x < 0 && dif_y < 0) { //第三象限（200,200-100,100）
        // <path d="M 200,200 L 200,155 M 200,155 A 5,5,0,0,0 195,150 M 195,150 L 105,150 M 105,150 A 5,5,0,0,1 100,145 M 100,145 L 100,100" fill="none" stroke="#0096f2" stroke-width="1"></path>
        link = 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + (mid_y+5) + 'M' + d.x + ',' + (mid_y+5) + 'A 5,5,0,0,0 ' + (d.x-5) + ',' + mid_y + 
          'M' + (d.x-5) + ',' + mid_y + 'L' + (des.x+5) + ',' + mid_y +'M' + (des.x+5) + ',' + mid_y + 'A 5,5,0,0,1' + des.x + ',' + (mid_y-5) + 
          'M' + des.x + ',' + (mid_y-5) + 'L' + des.x + ',' + des.y;
      }
      if (dif_x > 0 && dif_y < 0) { //第四象限（200,200-300,100）
        // <path d="M 200,200 L 200,155 M 200,155 A 5,5,0,0,1 205,150 M 205,150 L 295,150 M 295,150 A 5,5,0,0,0 300,145 M 300,145 L 300,100" fill="none" stroke="#0096f2" stroke-width="1"></path>
        link = 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + (mid_y+5) + 'M' + d.x + ',' + (mid_y+5) + 'A 5,5,0,0,1 ' + (d.x+5) + ',' + mid_y + 
          'M' + (d.x+5) + ',' + mid_y + 'L' + (des.x-5) + ',' + mid_y +'M' + (des.x-5) + ',' + mid_y + 'A 5,5,0,0,0' + des.x + ',' + (mid_y-5) + 
          'M' + des.x + ',' + (mid_y-5) + 'L' + des.x + ',' + des.y;
      }
    }
    return link;
  };

  /**
   * 获取此节点的连线
   * @param  {Object} node        此节点
   * @param  {Number} type        -1 连线指向此节点 1 此节点连出 undefined 所有连线
   * @return {Array}  linkedEdges 连线集合
   */
  GraphCreator.prototype.getLinkedEdges = function(node, type) {
    var thisGraph = this;
    var edges = thisGraph.edges;
    var linkedEdges;
    if (type == -1) {
      linkedEdges = edges.filter(function(edge) {
        return edge.target == node;
      });
    }
    if (type == 1) {
      linkedEdges = edges.filter(function(edge) {
        return edge.source == node;
      });
    }
    linkedEdges = edges.filter(function(edge) {
      return edge.target == node || edge.source == node;
    });
    return linkedEdges;
  };

  /**
   * 判断node有无连线
   * @param  {object}  node       节点
   * @param  {Boolean} isActivity 是否是与activity的连线，true 不包括开始和结束节点
   * @param  {Boolean} type       连线类型：-1 指向node 0 所有连线 1 从node连出
   * @return {Boolean}            hasLinked
   */
  GraphCreator.prototype.hasLinked = function(node, isActivity, type) {
    var thisGraph = this;
    isActivity = isActivity || false;
    type = type || 0;
    var edges = [];
    if (isActivity) {
      edges = thisGraph.edges.filter(function(edge, index) {
        return edge.source.type == 'activity' && edge.target.type == 'activity';
      });
    } else {
      edges = thisGraph.edges;
    }
    var hasLinked = edges.some(function(edge, index) {
      if (type == 0) {
        return edge.source.id == node.id || edge.target.id == node.id;
      } else if (type == -1) {
        return edge.target.id == node.id;
      } else if (type == 1) {
        return edge.source.id == node.id;
      }
    });
    return hasLinked;
  };

  /* PROTOTYPE FUNCTIONS */
  GraphCreator.prototype.dragmove = function(d) {
    var thisGraph = this;
    var drawLine = thisGraph.state.drawLine;
    var link;
    if (thisGraph.state.shiftNodeDrag || drawLine) {
      var svgG = thisGraph.svgG,
        dragLine = thisGraph.dragLine;
      switch (drawLine) {
        case 'NOROUTING': // 直线
          link = dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(svgG.node())[0] + ',' + d3.mouse(svgG.node())[1]);
          break;
        case 'SIMPLEROUTING': // 折线
          var des = {
            x: d3.mouse(svgG.node())[0], 
            y: d3.mouse(svgG.node())[1] 
          };
          var link_d = thisGraph.getLink_d(d, des);
          link = dragLine.attr('d', link_d);
          break;
      }
      refresh(link); // 兼容IE11
    } else {
      d.x += d3.event.dx;
      d.y += d3.event.dy;
      thisGraph.updateGraph();
      /*
      // 防止circle脱出svg范围(放大缩小后还存在问题，待修改...)
      var radius = thisGraph.consts.nodeRadius + thisGraph.consts.nodeRadiusVary,
        svg_width = $('svg').width(),
        svg_heigh = $('svg').height();
      d.x = Math.max(Math.min(d3.event.x, svg_width-radius), radius);
      d.y = Math.max(Math.min(d3.event.y, svg_heigh-radius), radius);
      thisGraph.updateGraph();*/
    }
  };

  GraphCreator.prototype.deleteGraph = function() {
    var thisGraph = this;
    thisGraph.nodes = [];
    thisGraph.edges = [];
    thisGraph.updateGraph();
  };

  /* select all text in element: taken from http://stackoverflow.com/questions/6139107/programatically-select-text-in-a-contenteditable-html-element */
  GraphCreator.prototype.selectElementContents = function(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  };


  /* insert svg line breaks: taken from http://stackoverflow.com/questions/13241475/how-do-i-include-newlines-in-labels-in-d3-charts */
  GraphCreator.prototype.insertTitleLinebreaks = function(gEl, d) {
    var words = d.title.split(/\s+/g),
      nwords = words.length;
    var el = gEl.append("text")
      .attr("text-anchor", "middle")
      .attr("letter-spacing", "1");
    switch (d.type) {
      case 'start':
      case 'end':
        el.attr("dy", "13");
        break;
      default:
        el.attr("dy", "-" + (nwords - 1) * 7.5);
        break;
    }
    for (var i = 0; i < words.length; i++) {
      var tspan = el.append('tspan').text(words[i]);
      if (i > 0)
        tspan.attr('x', 0).attr('dy', '15');
    }

  };

  // remove edges associated with a node
  GraphCreator.prototype.spliceLinksForNode = function(node) {
    var thisGraph = this,
      toSplice = thisGraph.edges.filter(function(l) {
        return (l.source === node || l.target === node);
      });
    toSplice.map(function(l) {
      thisGraph.edges.splice(thisGraph.edges.indexOf(l), 1);
    });
  };

  GraphCreator.prototype.replaceSelectEdge = function(d3Path, edgeData) {
    var thisGraph = this;
    d3Path.classed(thisGraph.consts.selectedClass, true);
    //修改箭头样式
    // d3Path.style('marker-end', 'url(#selected-end-arrow)');
    if (thisGraph.state.selectedEdge) {
      thisGraph.removeSelectFromEdge();
    }
    thisGraph.state.selectedEdge = edgeData;
  };

  GraphCreator.prototype.replaceSelectNode = function(d3Node, nodeData) {
    // A circle node has been selected.
    var thisGraph = this;
    d3Node.classed(this.consts.selectedClass, true);
    if (thisGraph.state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }
    thisGraph.state.selectedNode = nodeData;
  };

  GraphCreator.prototype.removeSelectFromNode = function() {
    // A circle node has been deselected.

    var thisGraph = this;
    thisGraph.circles.filter(function(cd) {
      return cd.id === thisGraph.state.selectedNode.id;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedNode = null;

    d3.selectAll("#inspector").remove();

  };

  GraphCreator.prototype.removeSelectFromEdge = function() {
    var thisGraph = this;
    thisGraph.paths.filter(function(cd) {
      return cd === thisGraph.state.selectedEdge;
    }).classed(thisGraph.consts.selectedClass, false);
    thisGraph.state.selectedEdge = null;
  };

  GraphCreator.prototype.pathMouseDown = function(d3path, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownLink = d;

    if (state.selectedNode) {
      thisGraph.removeSelectFromNode();
    }

    var prevEdge = state.selectedEdge;
    if (!prevEdge || prevEdge !== d) {
      thisGraph.replaceSelectEdge(d3path, d);
    } else {
      if(d3.event.button != 2){
        thisGraph.removeSelectFromEdge();
        // d.style('marker-end', 'url(#end-arrow)');
      }
    }
    if (d3.event.button == 2) {
      thisGraph.showMenu();
      // thisGraph.menuEvent();
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function(d3node, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;

    if (d3.event.shiftKey || thisGraph.state.drawLine) {
      var result = thisGraph.isAllowLinking(d);
      if (!result.success) {
        layer.msg(result.msg, {time: 2000, icon: 0, offset: '180px'});
        return;
      }      
      // Automatically create node when they shift + drag?
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      var link = thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      refresh(link);// 兼容IE11
      return;
    }
  };

  // mouseup on nodes
  GraphCreator.prototype.circleMouseUp = function(d3node, d) {
    var thisGraph = this,
      state = thisGraph.state,
      consts = thisGraph.consts;
    // reset the states
    state.shiftNodeDrag = false;
    d3node.classed(consts.connectClass, false);

    var mouseDownNode = state.mouseDownNode;
    if (!mouseDownNode) return;

    thisGraph.dragLine.classed("hidden", true);

    if (mouseDownNode !== d) {
      var result = thisGraph.isAllowLinked(d, mouseDownNode);
      if (!result.success) {
        layer.msg(result.msg, {time: 2000, icon: 0, offset: '180px'});
        return;
      }
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = {
        edgeId: seqer_edgeID.gensym(),
        postCondition: {transitionEventType: 'transitionClass'},
        source: mouseDownNode,
        target: d,
        drawLine: thisGraph.state.drawLine
      };
      var filtRes = thisGraph.paths.filter(function(d) {
        if (d.source === newEdge.target && d.target === newEdge.source) {
          thisGraph.edges.splice(thisGraph.edges.indexOf(d), 1);
        }
        return d.source === newEdge.source && d.target === newEdge.target;
      });
      if (!filtRes[0].length) {
        thisGraph.edges.push(newEdge);
        thisGraph.updateGraph();
      }
    } else {
      // we're in the same node
      var prevNode = state.selectedNode;
      if (state.justDragged) {
        // dragged, not clicked
        if (state.selectedEdge) {
          thisGraph.removeSelectFromEdge();
        }
        if (!prevNode || prevNode !== d) {
          thisGraph.replaceSelectNode(d3node, d);
          thisGraph.changePropDiv(d); // 添加更改属性div
        } else {
          // thisGraph.removeSelectFromNode();
        }
      
      } else {
        // clicked, not dragged
        if (d3.event.shiftKey) {

        } else {
          if (state.selectedEdge) {
            thisGraph.removeSelectFromEdge();
          }
          if (!prevNode || prevNode !== d) {
            thisGraph.replaceSelectNode(d3node, d);
            thisGraph.changePropDiv(d); // 添加更改属性div
            thisGraph.showMenu();
            // thisGraph.menuEvent();
          } else {
            if (d3.event.button == '2') {
              thisGraph.showMenu();
              // thisGraph.menuEvent();
            } else {
              thisGraph.removeSelectFromNode();
            }
          }
        }
      }
    }
    state.mouseDownNode = null;
    state.justDragged = false;
    return;

  }; // end of circles mouseup

  /**
   * 判断节点是否允许被连线
   * @param  {Object}  mouseDownNode 连线开始节点
   * @param  {Object}  eventNode     连线结束节点
   * @return {Object}                连线是否成功信息
   */
  GraphCreator.prototype.isAllowLinked = function(eventNode, mouseDownNode) { 
    var thisGraph = this;
    var result = {
      success: true,
      msg: ''
    };
    switch (eventNode.type) {
      case 'start':
        result.success = false;
        result.msg = '不允许';
        break;
      case 'end':
        if (thisGraph.hasLinked(eventNode)) {
          result.success = false;
          result.msg = '已有连线！';
        }
        break;
    }
    switch (mouseDownNode.type) {
      case 'start':
        if (thisGraph.hasLinked(mouseDownNode)) {
          result.success = false;
          result.msg = '已有连线！';
        }
        break;
      case 'end':
        result.success = false;
        result.msg = '不允许';
        break;
      case 'activity':
        var edges = thisGraph.getLinkedEdges(mouseDownNode, 1);
        var edgeLinkEnd = edges.filter(function(edge) {
          return edge.target.type == 'end';
        });
        if (edgeLinkEnd.length) {
          result.success = false;
          result.msg = '活动不能有转出转移！';
        }
        break;
    }
    return result;
  };

  /**
   * 判断节点是否允许连线
   * @param  {Object}  eventNode 出发实践节点对象 
   * @return {Object}            连线是否成功信息
   */
  GraphCreator.prototype.isAllowLinking = function(eventNode) {
    var thisGraph = this;
    var result = {
      success: true,
      msg: ''
    };
    switch (eventNode.type) {
      case 'start':
        if (thisGraph.hasLinked(eventNode)) { 
          result.success = false;
          result.msg = '已有连线！';
        }
        break;
      case 'end':
        result.success = false;
        result.msg = '不允许！';
        break;
      case 'activity':
        var edges = thisGraph.getLinkedEdges(eventNode, 1);
        var edgeLinkEnd = edges.filter(function(edge) {
          return edge.target.type === 'end';
        });
        if (edgeLinkEnd.length) {
          result.success = false;
          result.msg = '活动不能有转出转移！';
        }
      break;
    }
    return result;
  };

  //更改属性div
  GraphCreator.prototype.changePropDiv = function(d) {
    var thisGraph = this;
    $('.component-prop').empty().append(
        '<div>' + 
        '  <div name="id" class="prop-value"><span>id:</span><span>' + d.id + '</span></div>'+
        '  <div name="name" class="prop-value"><span>名称:</span><span>' + d.title + '</span></div>'+
        '</div>' +
        '<div class="clearfix"></div>'+
        '<div> ' +
        '  <div name="type" class="prop-value"><span>类型:</span><span>' + d.component + '</span></div>'+
        '  <div name="" class="prop-value"><span>执行者:</span><span>无</span></div>' +
        '</div>' +
        '<div class="clearfix"></div>');
  };

  // 右击显示菜单
  GraphCreator.prototype.showMenu = function() {
    var thisGraph = this;
    $('#flowComponents div[name=selectBtn]').trigger('click'); 
    thisGraph.circles.style({'cursor': 'default'}); // 防止在活动块上右击存在问题
    var selectedNode = thisGraph.state.selectedNode,
      selectedEdge = thisGraph.state.selectedEdge;
    if (selectedNode) {
      if (selectedNode.type == 'activity') {
        $('#rMenu a[name=propMenu]').show();
        if (selectedNode.component == 'blockActivity') {
          $('#rMenu a[name=editMenu]').show();
        } else {
          $('#rMenu a[name=editMenu]').hide();
        }
      } else {
        $('#rMenu a[name=propMenu]').hide();
        $('#rMenu a[name=editMenu]').hide();
      }
    } else if (selectedEdge) {
      var sourceType = selectedEdge.source.type,
        targetType = selectedEdge.target.type;
      $('#rMenu a[name=editMenu]').hide();
      if (sourceType == 'start' || targetType == 'end') {
        $('#rMenu a[name=propMenu]').hide();
      } else {
        $('#rMenu a[name=propMenu]').show();
      }
    }
    d3.select("#rMenu").style({ 
      "top": (d3.event.clientY-2)+"px", 
      "left": (d3.event.clientX-2)+"px", 
      "display": "block" 
    });
    d3.select('#rMenu').on('contextmenu', function() {
      d3.event.preventDefault();
    });
  };

  // mousedown on main svg
  GraphCreator.prototype.svgMouseDown = function() {
    this.state.graphMouseDown = true;
  };

  // mouseup on main svg
  GraphCreator.prototype.svgMouseUp = function() {
    var thisGraph = this,
      state = thisGraph.state;
    if (state.justScaleTransGraph) {
      // dragged not clicked
      state.justScaleTransGraph = false;
    } else if (state.graphMouseDown && d3.event.shiftKey) {
      // clicked not dragged from svg
      var xycoords = d3.mouse(thisGraph.svgG.node()),
        d = {
          id: seqer_nodeID.gensym(),
          title: '普通活动',
          component: 'ordinaryActivity',
          type: 'activity',
          x: xycoords[0],
          y: xycoords[1],
          conventional: {
            MustActivity: true, 
            taskAssign: 'taskAutoMode', 
            autoAcceptAllAssignments: true, 
            isResponsible: true,
            startMode: 'manual',
            finishMode: 'manual'
          },
          frontCondition: {},
          postCondition: {},
          extendAttr: [],
          highLevel: {},
          timeoutLimit: {},
          monitorinf: {isResponsibleTem: true},
          eventTypeId: null
        };
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
    } else if (state.shiftNodeDrag || state.drawLine) {
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);//win7 IE11下存在bug
    }
    state.graphMouseDown = false;
  };

  // keydown on main svg
  GraphCreator.prototype.svgKeyDown = function() {
    var thisGraph = this,
      state = thisGraph.state,
      consts = thisGraph.consts;
    // make sure repeated key presses don't register for each keydown
    if (state.lastKeyDown !== -1) return;

    state.lastKeyDown = d3.event.keyCode;
    var selectedNode = state.selectedNode,
      selectedEdge = state.selectedEdge;
    /*
    switch (d3.event.keyCode) {
      //case consts.BACKSPACE_KEY:
      case consts.DELETE_KEY:
        d3.event.preventDefault();
        if (selectedNode) {
          thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
          thisGraph.spliceLinksForNode(selectedNode);
          state.selectedNode = null;
          thisGraph.updateGraph();
          // thisGraph.
        } else if (selectedEdge) {
          thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
          state.selectedEdge = null;
          thisGraph.updateGraph();
        }
        break;
    }*/
  };

  GraphCreator.prototype.svgKeyUp = function() {
    this.state.lastKeyDown = -1;
  };

  // call to propagate changes to graph
  GraphCreator.prototype.updateGraph = function() {
    var thisGraph = this,
      consts = thisGraph.consts,
      state = thisGraph.state,
      nodes = thisGraph.nodes, 
      edges = thisGraph.edges;
    
    thisGraph.paths = thisGraph.paths.data(edges, function(d) {
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var paths = thisGraph.paths;
    // update existing paths
    var link = paths.style('marker-end', 'url(#'+thisGraph.containerId+'-end-arrow)')
      .classed(consts.selectedClass, function(d) {
        return d === state.selectedEdge;
      })
      .attr("conditype", function(d) {
        if (d.postCondition) {
          return changeCase(d.postCondition.conditype, 5);
        } else {
          return '';
        }
      })
      .attr("d", function(d) {
        if (d.drawLine == 'NOROUTING') {
          return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
        }
        if (d.drawLine == 'SIMPLEROUTING') {
          var start = {
            x: d.source.x,
            y: d.source.y
          };
          var des = {
            x: d.target.x,
            y: d.target.y
          };
          return thisGraph.getLink_d(start, des);
        }
      });
    refresh(link); // 兼容IE11

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end', 'url(#'+thisGraph.containerId+'-end-arrow)')
      .classed("link", true)
      .attr("conditype", function(d) {
        if (d.postCondition) {
          return changeCase(d.postCondition.conditype, 5);
        } else {
          return '';
        }
      })
      .attr("d", function(d) {
        if (d.drawLine == 'NOROUTING') {
          return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
        }
        if (d.drawLine == 'SIMPLEROUTING') {
          var start = {
            x: d.source.x,
            y: d.source.y
          };
          var des = {
            x: d.target.x,
            y: d.target.y
          };
          return thisGraph.getLink_d(start, des);
        }
      })
      .on("mousedown", function(d) {
        thisGraph.pathMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function(d) {
        state.mouseDownLink = null;
      });

    // remove old links
    paths.exit().remove();

    // update existing nodes
    thisGraph.circles = thisGraph.circles.data(nodes, function(d) {
      return d.id;
    });
    thisGraph.circles.attr("transform", function(d) {
      if (d == state.selectedNode) { // 更新节点名称
        var tspan = d3.select(this).select('tspan');
        if (tspan.text() !== d.title) {
          tspan.text(d.title);
        }
      }
      return "translate(" + d.x + "," + d.y + ")";
    });

    // add new nodes
    var newGs = thisGraph.circles.enter()
      .append("g")
        .attr({"id": function(d) { return generateUUID(); }});

    newGs.classed(consts.circleGClass, true)
      .attr("transform", function(d) {
        return "translate(" + d.x + "," + d.y + ")";
      })
      .on("mouseover", function(d) {
        if (state.shiftNodeDrag) {
          d3.select(this).classed(consts.connectClass, true);
        }
      })
      .on("mouseout", function(d) {
        d3.select(this).classed(consts.connectClass, false);
      })
      .on("mousedown", function(d) {
        thisGraph.circleMouseDown.call(thisGraph, d3.select(this), d);
      })
      .on("mouseup", function(d) {
        thisGraph.circleMouseUp.call(thisGraph, d3.select(this), d);
      })
      .call(thisGraph.drag);

    newGs.append("circle")
      .attr("r", String(consts.nodeRadius));

    newGs.each(function(d) {
      switch (d.type) {
        case 'start':
          d3.select(this).classed('start', true);
          break;
        case 'end':
          d3.select(this).classed('end', true);
          break;
      }
      thisGraph.insertTitleLinebreaks(d3.select(this), d);
    });

    // remove old nodes
    thisGraph.circles.exit().remove();
  };
  
  GraphCreator.prototype.zoomed = function() {
    this.state.justScaleTransGraph = true;
    var translate = this.dragSvg.translate();
    var scale = this.dragSvg.scale();
    if (!translate[0]) translate = [0, 0];
    if (!scale) scale = 1;
    d3.select(".full-right>.tab.active ." + this.consts.graphClass)
      .attr("transform", "translate(" + translate + ") scale(" + scale + ")");
  };

  GraphCreator.prototype.updateWindow = function(svg) {
    var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };

  /**
   * 创建子流程graph对象
   */
  GraphCreator.prototype.createSubGraph = function() {
    var thisGraph = this;
    var containerId = d3.select('.full-right>.tab.active').attr('data-tab'),
      activitySetId = d3.select('.full-right>.menu>.item.active').attr('activitysetid');

    var svg = d3.select('.full-right>.tab.active .svg-container').append("svg")
      .attr("width", "100%")
      .attr("height", "100%");
    /*
    var editedBlockNode = graph_main.nodes.find(function(node) {
      return (node.component == 'blockActivity' && node.activitySet.activitySetId == activitySetId);
    });*/
    var editedBlockNode = thisGraph.state.selectedNode;

    var subGraph = editedBlockNode.activitySet.graphCreator;
    var pools = graphPool.pools;
    var isExist = pools.indexOf(subGraph);
    if (isExist === -1) {
      var graph_active;
      if (subGraph) {
        graph_active = new GraphCreator(containerId, svg, subGraph.nodes, subGraph.edges, subGraph.participants);
      } else {
        graph_active = new GraphCreator(containerId, svg, [], [], []);
        editedBlockNode.activitySet.graphCreator = graph_active;
      } 
      pools.push(graph_active);
      graphPool.updateGraphActiveById(containerId);
      graph_active.updateGraph();
    }
  };

  GraphCreator.prototype.createNode = function(data) {
    var node;
    switch (data.type) {
      case 'activity':
        node = {
          id: seqer_nodeID.gensym(),
          title: data.text,
          component: data.component,
          type: data.type,
          x: data.x,
          y: data.y,
          conventional: {
            MustActivity: true, 
            taskAssign: 'taskAutoMode', 
            autoAcceptAllAssignments: true, 
            isResponsible: true,
            startMode: 'manual',
            finishMode: 'manual'
          },
          frontCondition: {},
          postCondition: {},
          extendAttr: [],
          highLevel: {},
          timeoutLimit: {},
          monitorinf: {isResponsibleTem: true},
          eventTypeId: null
        };
        if (data.component == 'blockActivity') {
          node.activitySet = {
            activitySetId: seqer_blockId.gensym(),
            graphCreator: null
          };
        }
        break;
      default: // 开始、结束节点
        node = {
          id: generateUUID(),
          title: data.text,
          component: data.component,
          type: data.type,
          x: data.x,
          y: data.y
        };
        break;
    }
    return node;
  };


  /**** MAIN ****/
  var container = d3.select('[data-tab="tab_main"] .svg-container').node(),
    containerId = 'tab_main';

  var svg = d3.select('[data-tab="tab_main"] .svg-container').append("svg")
    .attr("width", "100%")
    .attr("height", container.clientHeight);

  var initialDate = initFlowChart();
  window.graph_main = new GraphCreator(containerId, svg, initialDate.nodes, initialDate.edges, initialDate.participants);
  graphPool.pools.push(graph_main);
  graph_main.updateGraph();
  initCommonEvent();

})(window.d3, window.saveAs, window.Blob, vkbeautify);

function initCommonEvent() {
  $('.editor-toolbar').on('click', '.sign.in,.sign.out', handleImportOrExport);
  $('.full-right').on('click', '.full-right-btn .item', handleViews);
  $('.editor-toolbar #delete-ele').on('click', handleDeleteNode);
  $('.editor-toolbar #zoom-enlarge,#zoom-narrow').on('click.zoom', handleClickZoom);
  $("#reset-zoom").on("click", resetZoom);
  $('#helper').on('click', handleHelp);
  $('#flowComponents .components-btn').on('click', handleComponentsBtn);
  $("#delete-graph").on("click", clearGraph);
  $('.editor-toolbar .icon.save').on('click', handleSave);
  $('#rMenu .item').on('click', handleRightMenu);
  $('.full-left [name=addStartEndBtn]').on('click', handleAddStartEnd);
}

function initFlowChart() {
  var initialDate = {
    nodes: [],
    edges: [],
    participants: []
  };
  // if (create_type == 'create') return;
  if (create_type == 'Show') {
    $.ajax({ // handle=Show&id=Package_njyaCNBY&type=xpdl&onlycode=23653VB5&fornocache=KXW33813
      url: "../wfdurl/urlConfig.do",
      type: "post",
      async: false,
      data: {
        "handle": create_type,
        "id": package_id,
        "type": 'xpdl',
        "onlycode": '23653VB5',
        "fornocache": 'KXW33813'
      },
      dataType: "html",
      success: function(result) {
        initialDate = importXpdl(result);
      },
      error: function(data) {
        alert("服务器繁忙,请稍后再试...");
      }
    });
  }
  return initialDate;
}

//根据xpdl格式还原流程图
function importXpdl(str) {
  str = vkbeautify.xmlmin(str);
  var nodes = [],
    edges = [],
    initialDate = {},
    error = {
      messages: []
    };

  while ((str = str.replace(":", "_")) && (str.indexOf(":") > -1));
  var root = $("<ROOT>" + str + "</ROOT>");
  if (!root.find("WorkflowProcess").length) {
    error.messages.push("XPDL:WorkflowProcess node not found");
    console.error(error.messages);
    return false;
  }

  var nodesId_seq = [], // node id 序列数组
    edgesId_seq = [], // edge id 序列数组
    participants = []; // 参与者集
  // 活动加入nodes
  root.find("Activities Activity").each(function() {
    var id = $(this).attr('id'),
      name = $(this).attr('name'),
      x = parseInt($(this).find('ExtendedAttribute[name=XOffset]').attr('Value')),
      y = parseInt($(this).find('ExtendedAttribute[name=YOffset]').attr('Value'));
      
    var syncType = $(this).find('ExtendedAttribute[name=syncType]').attr('Value');
    var responsible = $(this).find('ExtendedAttribute[name=responsible]').attr('Value');
    var conventional = { // 常规
        startMode: $(this).find('StartMode').html().replace(/<(\w+)>.+/g, function(match, p1) {return p1;}),
        finishMode: $(this).find('FinishMode').html().replace(/<(\w+)>.+/g, function(match, p1) {return p1;}),
        isMulInstance: $(this).find('ExtendedAttribute[name=isMulInstance]').attr('Value'),
        isResponsible: $(this).find('ExtendedAttribute[name=isResponsible]').attr('Value'), // true or false
        autoAcceptAllAssignments: $(this).find('ExtendedAttribute[name=autoAcceptAllAssignments]').attr('Value'), // true or false
        completeAllAssignments: $(this).find('ExtendedAttribute[name=completeAllAssignments]').attr('Value'),
        assignmentsOrder: $(this).find('ExtendedAttribute[name=assignmentsOrder]').attr('Value'),
        description: $(this).find('Description').html(),
        taskAssignMode: $(this).find('ExtendedAttribute[name=taskAssignMode]').attr('Value'),
        mustActivity: $(this).find('ExtendedAttribute[name=MustActivity]').attr('Value'), // true or false
        participantID: $(this).find('ExtendedAttribute[name=ParticipantID]').attr('Value'),
        performer: $(this).find('Performer').html()
      },
      frontCondition = { // 前置条件
        convergeType: $(this).find('TransitionRestriction Join').attr('Type'),
        isCreateNew: $(this).find('ExtendedAttribute[name=isCreateNew]').attr('Value'),
        voteModel: syncType && syncType.split('|')[0],
        voteText: syncType && syncType.split('|')[1] || ''
      },
      timeoutLimit = { // 超时限制
        limitTime: $(this).find('Limit').html(),
        warnTime: $(this).find('ExtendedAttribute[name=warnTime]').attr('Value'),
        warnAgentClassName: $(this).find('ExtendedAttribute[name=warnAgentClassName]').attr('Value'),
        limitAgentClassName: $(this).find('ExtendedAttribute[name=LimitAgentClassName]').attr('Value'),
        deadline: []
      },
      highLevel = { // 高级
        activityEndEvent: $(this).find('ExtendedAttribute[name=ActivityEndEvent]').attr('Value'),
        activityCreateEvent: $(this).find('ExtendedAttribute[name=ActivityCreateEvent]').attr('Value'),
        finishRule: $(this).find('ExtendedAttribute[name=FinishRule]').attr('Value') 
      },
      monitorinf = { // 监控信息
        isResponsibleTem: $(this).find('ExtendedAttribute[name=isResponsibleTem]').attr('Value'),
        responsible: responsible && responsible.split(',') || ''
      };
    $(this).find('Deadline').each(function() {
      var json_obj = {
          execution: $(this).attr('Execution'),
          deadlineCondition: $(this).find('DeadlineCondition').html(),
          exceptionName: $(this).find('ExceptionName').html()
      };
      timeoutLimit.deadline.push(JSON.stringify(json_obj));
    });
    
    var extendAttr = []; // 扩展属性集
    $(this).find('ExtendedAttribute[name=YOffset]').nextAll().each(function() { 
      var json_obj = {name: $(this).attr('name'), value: $(this).attr('Value')};
      extendAttr.push(JSON.stringify(json_obj));
    });
      
    var d = {
            id: id,
            title: name,
            //component要根据xpdl确定---未修改
            component: name=='普通活动'?'ordinaryActivity':name=='块活动'?'blockActivity':name=='子活动'?'subFlowActivity':name=='路径活动'?'routeActivity':'',
            type: 'activity',
            x: x,
            y: y,
            conventional: conventional,
            frontCondition: frontCondition,
            postCondition: {},
            extendAttr: extendAttr,
            timeoutLimit: timeoutLimit,
            highLevel: highLevel,
            monitorinf: monitorinf,
            eventTypeId: null
          };
      nodes.push(d);
      
      var result = /_Act([0-9]+)$/.exec(id);
      nodesId_seq.push(result[1]);
      
  });
  //活动之间连线加入edges
  root.find("Transitions Transition").each(function() {
    var from_actId = $(this).attr('From'),
      to_actId = $(this).attr('To'),
      edgeId = $(this).attr('Id'),
      drawLine = $(this).find('[name=RoutingType]').attr('Value'),
      transitionEventType = $(this).find('[name=TransitionEventType]').attr('Value');
    var edge = {
            edgeId: edgeId,
            postCondition: {transitionEventType: transitionEventType},
            drawLine: drawLine
          };
    
    nodes.forEach(function(node, i) {
      if (node.id == from_actId) {
        edge.source = nodes[i];
      }
      if (node.id == to_actId) {
        edge.target = nodes[i];
      }
    });
    edges.push(edge);
    var result = /_Tra([0-9]+)$/.exec(edgeId);
      edgesId_seq.push(result[1]);
  });
  if (edgesId_seq.length) {// 重新设置edge id 序列后缀
    var seq = maxArr(edgesId_seq) + 1;
    seqer_edgeID.set_seq(seq);
  }
  //开始、结束的node及开始、结束连接的edge--------------------------有改动 未测试
  var regExp_act = /_Act([0-9]+)$/;
  root.find('WorkflowProcess>ExtendedAttributes ExtendedAttribute[name$=OfWorkflow]').each(function() {
    var label_name = $(this).attr('name');
    var label_vals = $(this).attr('Value').split(';');
    var d = {
              id: label_vals[0],
              /*title: '开始',
              component: 'startComponent',
              type: 'start',*/
              x: parseFloat(label_vals[2]),
              y: parseFloat(label_vals[3]),
              eventTypeId: null
            };
    switch (label_name) {
      case 'StartOfWorkflow':
        d.title = '开始';
        d.component = 'startComponent';
        d.type = 'start';
        nodes.push(d);

        var result = regExp_act.exec(label_vals[0]);
            nodesId_seq.push(result[1]);
        if (label_vals[1] != -1) {
          nodes.forEach(function(node, i) {
            if (node.id == label_vals[1]) {
              var edge = {
                edgeId: seqer_edgeID.gensym(),  
                drawLine: label_vals[4],
                source: nodes[nodes.length-1],
                target: node
              };
              edges.push(edge);
            }
          });
        }
        break;
      case 'EndOfWorkflow':
        d.title = '结束';
        d.component = 'endComponent';
        d.type = 'end';
        nodes.push(d);

        var match = regExp_act.exec(label_vals[0]);
            nodesId_seq.push(match[1]);
        if (label_vals[1] != -1) {
          nodes.forEach(function(node, i) {
            if (node.id == label_vals[1]) {
              var edge = {
                edgeId: seqer_edgeID.gensym(),  
                drawLine: label_vals[4],
                source: node,
                target: nodes[nodes.length-1]
              };
              edges.push(edge);
            }
          });
        }
        break;
    }
  });
  
  if (nodesId_seq.length) {// 重新设置 node id 序列后缀
    seqer_nodeID.set_seq(maxArr(nodesId_seq) + 1);
  }
  
  //参与者集
  root.find("Participants Participant").each(function() {
    var participant = {
        conventional_definition_id: $(this).attr('Id'),
        conventional_definition_name: $(this).attr('Name'),
        conventional_definition_description: $(this).find('Description').html(),
        conventional_definition_participant: $(this).find('ExtendedAttribute[name=PartyBeanId]').attr('Value'),
        typeName: [],
        isAppData: [],
        itemName: [],
        itemValue: [],
        secLevelS: [],
        secLevelE: [],
        condition: [],
        conditionXml: [],
        roleName: []
    };
    $(this).find('ExtendedAttributes ExtendedAttribute').each(function() {
      var value = $(this).attr('Value') || $(this).html();
      participant[$(this).attr('Name')] = value.split(',');
    });
    
    participants.push(participant);
  });
  
  initialDate.nodes = nodes;
  initialDate.edges = edges;
  initialDate.participants = participants;
  return initialDate;
}

/**
 * svg
 * refresh 连线兼容IE11
 * @param  {[type]} link [改变attr后的dragLine]
 * 
 */
function refresh(link) {
  if (/(MSIE 10)|(Trident)/.test(navigator.appVersion)) {
    if (link[0] instanceof Array) {
      link[0].forEach( function(item) {
        item.parentNode.insertBefore(item, item);
      });
    } else if (link[0]) {
      var svgNode = link.node();
      svgNode.parentNode.insertBefore(svgNode, svgNode);
    }
  }
}
