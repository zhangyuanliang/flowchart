document.onload = (function(d3, saveAs, Blob, vkbeautify) {
  "use strict";

  // define graphcreator object
  var GraphCreator = function(svg, nodes, edges, participants) {
    var thisGraph = this;
    console.log('thisGraph:');
    console.log(thisGraph);

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];
    thisGraph.participants = participants || [];

    thisGraph.state = {
      selectedNode: null,
      selectedEdge: null,
      mouseDownNode: null,
      mouseDownLink: null,
      justDragged: false,
      justScaleTransGraph: false,
      lastKeyDown: -1,
      shiftNodeDrag: false,
      selectedText: null,
      drawLine: null
    };

    // define arrow markers for graph links
    var defs = svg.append('defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 42)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    //define arrow markers for leading arrow
    defs.append('marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    //定义选中样式的箭头
    defs.append('marker')
      .attr('id', 'selected-end-arrow')
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
      .style('marker-end', 'url(#mark-end-arrow)');

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

    // help icon click
    d3.select("#help").on("click", function() {
      $('#helpbox').removeClass('hidden');
    });

    // reset zoom
    d3.select("#reset-zoom").on("click", function() {
      d3.select(".graph")
        .transition() // start a transition
        .duration(1000) // make it last 1 second
        .attr('transform', "translate(0,0) scale(1)");

      dragSvg.scale(1);
      dragSvg.translate([0,0]);
    });

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
            thisGraph.deleteGraph(true);
            thisGraph.nodes = jsonObj.nodes;
            // thisGraph.setIdCt(jsonObj.nodes.lessssngth + 1);
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

    // handle delete graph
    d3.select("#delete-graph").on("click", function() {
      thisGraph.deleteGraph(false);
    });

    $('#flowComponents .components-btn[type]').not('.noComponent').attr('draggable', 'true')
      .on('dragstart', function(ev) {
        $(this).siblings().removeClass('active').end().addClass('active');
        $('.full-right-top').css({
            'border': '1px dashed #37F537'
          });
        /* 设置拖动过程显示图片
        var icon = document.createElement('img');
        icon.src = $(this).find('img').attr('src');
        ev.originalEvent.dataTransfer.setDragImage(icon,10,10);*/
        var json_obj = {
          text: $(this).find('span').text(),
          shapename: $(this).attr('for-name'),
          component: $(this).attr('name'),
          type: $(this).attr('type')
        };
        ev.originalEvent.dataTransfer.setData('text', JSON.stringify(json_obj));
        // $('#reset-zoom').trigger("click");
      })
      .on('dragend', function(ev) {
        $('.full-right-top').css({
          'border': '1px dashed #FFF'
        });
      }); 
    $('#container').on('drop', function(ev) {
      ev.stopPropagation(); //阻止冒泡
      ev.preventDefault(); //阻止默认行为
      var position = {};
      position.x = parseInt(ev.originalEvent.offsetX);
      position.y = parseInt(ev.originalEvent.offsetY);
      
      var transform = $(this).find('.graph').attr('transform');
      if (transform) {
        var result = [];
        var p = /\(([^)]*)\)/g;
        var ele;
        while ((ele=p.exec(transform)) != null) {
           result.push(ele[1]);
        }
        var translate = result[0] && result[0].split(',') || [0, 0];
        var scale = result[1] && result[1].split(',')[0] || 1;
        position.x = (position.x - translate[0])/scale;
        position.y = (position.y - translate[1])/scale;

      }

      var data = JSON.parse(ev.originalEvent.dataTransfer.getData('text')),
        shapeId = data.shapename + new Date().getTime(),
        isCreate = true;
      var d = {
          id: seqer_nodeID.gensym(),
          title: data.text,
          component: data.component,
          type: data.type,
          x: position.x,
          y: position.y,
          conventional: {
            mustActivity: true, 
            taskAssignMode: 'taskAutoMode', 
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
    })
    .on('dragover', function(ev) {
        ev.preventDefault();
      });

    //选择左侧工具
    $('#flowComponents .components-btn').on('click', function() {
      $(this).siblings().removeClass('active').end().addClass('active');
      var nodeName = $(this).attr('name');
      if ('NOROUTING' == nodeName || 'SIMPLEROUTING' == nodeName) {
        thisGraph.state.drawLine = nodeName;
        $('#container').on('mouseover mouseout', '.conceptG', function(e) {
          if (e.type == 'mouseover') {
            this.style.cursor = 'crosshair';
          } else if (e.type == 'mouseout') {
            this.style.cursor = 'default';
          }
        });
      } else {
        $('#container').off('mouseover mouseout', '.conceptG');
        thisGraph.state.drawLine = null;
      }
    });

    //切换标签时获取xml和xpdl
    $('.full-right-btn.menu .item').on('click', function() {
      var dataTab = $(this).attr('data-tab');
      if(dataTab == 'third'){ //xml视图
        var XmlContent = thisGraph.emergeAllXmlContent();
        $('#xmlContainer xmp').empty().text(XmlContent);
      }
      if(dataTab == 'second'){ //xpdl视图
        var xpdlContent = thisGraph.emergeAllxpdlContent();
        $('#xpdlContainer xmp').empty().text(xpdlContent);
      }
    });

    //点击导入导出按钮
    $('.editor-toolbar').on('click', '.sign.in,.sign.out', function(event) {
      var isImport = $(this).hasClass('in');
      $('.ui.modal.json_data').modal({
        onDeny: function(){
          // window.alert('取消!');
        },
        onApprove: function() {
          if (isImport) {
            var jsonStr = $('div.json_data textarea').val();
            if (jsonStr) {
              var json = JSON.parse(jsonStr);
              var edges = [];
              var nodes =json.nodes;

              json.edges.forEach(function(item) {
                var source = item.source.id;
                var target = item.target.id;
                var edge = {};
                edge.edgeId = item.edgeId;
                edge.drawLine = item.drawLine;
                edge.postCondition = item.postCondition;
                json.nodes.forEach(function(node) {
                  if (source == node.id) edge.source = node;
                  if (target == node.id) edge.target = node;
                });
                edges.push(edge);
              });
              thisGraph.nodes = thisGraph.nodes.concat(nodes);
              thisGraph.edges = thisGraph.edges.concat(edges);
              graph.updateGraph();
            }
          }
        },
        onHidden: function(){
          $('#div.json_data input, textarea').val('');
        }
      })
      .modal('setting', 'transition', 'scale')
      .modal('show');

      if ($(this).hasClass('in')) {
        $('div.json_data .header').text('导入数据');
      } else {
        $('div.json_data .header').text('导出数据');
        var json = {};
        json.nodes = thisGraph.nodes;
        json.edges = thisGraph.edges;
        $('div.json_data textarea').val(JSON.stringify(json));
      }
    });
    
    //删除单个元素
    $('.editor-toolbar #delete-ele').on('click', function() {
      var selectedNode = thisGraph.state.selectedNode,
        selectedEdge = thisGraph.state.selectedEdge;
      if (!selectedNode && !selectedEdge) {
        layer.msg('请选中元素！', {time: 2000, icon: 0, offset: '180px'});
        return;
      } else {
        //询问框
        layer.confirm('确定要删除选择元素吗？', {
          icon: 0,
          btn: ['确定','取消'], //按钮
          offset: '180px'
        }, function() {
          if (selectedNode) {
            thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
            thisGraph.spliceLinksForNode(selectedNode);
            thisGraph.state.selectedNode = null;
            thisGraph.updateGraph();
          } else if (selectedEdge) {
            thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
            thisGraph.state.selectedEdge = null;
            thisGraph.updateGraph();
          }
          layer.msg('删除成功', {icon: 1, offset: '180px', time: 600});
        }, function() {
          
        });
      }
    });
    
    //放大、缩小按钮 scale(0.3-2)
    d3.selectAll('.editor-toolbar #zoom-enlarge,#zoom-narrow').on('click', function() {
      var translate = dragSvg.translate(),
        scale = dragSvg.scale(),
        extent = dragSvg.scaleExtent(),
        direction = 1,
        factor = 0.1;

      direction = (this.id === 'zoom-enlarge') ? 1 : -1;
      if ((scale <= extent[0] && direction < 0) || (scale >= extent[1] && direction > 0)) {
        return;
      } else {
        scale = parseFloat(scale) + factor*direction;
      }
      dragSvg.scale(scale)
          .translate(translate);
      thisGraph.zoomed.call(thisGraph);
    });

    //右击菜单
    $('#rMenu .item').on('click', function() {
      var item = $(this).attr('name');
      var selectedNode = thisGraph.state.selectedNode,
      selectedEdge = thisGraph.state.selectedEdge;
      if (item == 'removeMenu') {
        if (!selectedNode && !selectedEdge) return false;
        //询问框
        layer.confirm('确定要删除选择元素吗？', {
          icon: 0,
          btn: ['确定','取消'], //按钮
          offset: '180px'
        }, function() {
          if (selectedNode) {
              thisGraph.nodes.splice(thisGraph.nodes.indexOf(selectedNode), 1);
              thisGraph.spliceLinksForNode(selectedNode);
              thisGraph.state.selectedNode = null;
              thisGraph.updateGraph();
          } else if (selectedEdge) {
            thisGraph.edges.splice(thisGraph.edges.indexOf(selectedEdge), 1);
            thisGraph.state.selectedEdge = null;
            thisGraph.updateGraph();
          }
          layer.msg('删除成功', {icon: 1, offset: '180px', time: 600});
        }, function() {
          
        });
      }
      if (item == 'toFront') {
        alert('前置');
      }

      //更新-后置条件或转移属性
      var updatePostCondi = function(selector) {
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
          var $transferInf = $(selector).find('div[data-tab="four/a"]');//转移信息
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
          var $event = $(selector).find('div[data-tab="four/c"]');//事件（标签）
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

      //展示-后置条件或转移属性
      var showTransition = function(selector, transition) {
        //清空 转移信息/条件设置/事件
        $(selector).find('.tab').find('input, textarea').val('');
        $(selector).find('.tab').find('select').dropdown('clear');
        $(selector).find('tbody').empty();
        $(selector).find('.postCondi_extendedAttr').mCustomScrollbar("update");
        //转移信息
        $(selector).find('input[name="edgeId"]').val(transition.edgeId);
        $(selector).find('input[name="edgeName"]').val(transition.postCondition && transition.postCondition.edgeName || '');
        $(selector).find('input[name="sourceTitle"]').val(transition.source.title);
        $(selector).find('input[name="targetTitle"]').val(transition.target.title);
        $(selector).find('textarea[name="description"]').val(transition.postCondition && transition.postCondition.description || '');
        //遍历扩展属性
        if (transition.postCondition.extendedAttrs) {
          transition.postCondition.extendedAttrs.forEach(function(item) {
            var extendedAttr = JSON.parse(item);
            var data = {name: extendedAttr.name, value: extendedAttr.value};
            data = {data:data, jsonstr:JSON.stringify(data)};
            var html = juicer($('#extended_attr_tpl').html(), data);
            $('.transferInf_extended_attr tbody').append(html).find('.ui.checkbox').checkbox();
            $(".transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar("update");
          });
        }
        //遍历条件设置-类型（条件）下列表
        if (transition.postCondition && transition.postCondition.conditype == 'CONDITION') {
          if (transition.postCondition.condixml) {//condixml base64
            var fieldConditions_obj = {fieldCondition:[]};
            var fieldConditions_str = Base64.decode(transition.postCondition.condixml);
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
        if (transition.postCondition && transition.postCondition.conditype == 'WORKFLOWBEAN') {
          if (transition.postCondition.condixml) {
            var beanConditions_obj = {beanCondition:[]};
            var beanConditions_str = Base64.decode(transition.postCondition.condixml);
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
        if (transition.postCondition) {
          $(selector).find('select[name="conditype"]').parent().dropdown('set selected', transition.postCondition.conditype || '');
          
          $(selector).find('select[name="transitionEventType"]').parent().dropdown('set selected', transition.postCondition.transitionEventType || '');
          $(selector).find('input[name="transitionEvent"]').val(transition.postCondition.transitionEvent);
        }

      };

      //属性弹出层(节点)
      if (item == 'propMenu' && selectedNode) {
        $('.ui.modal.prop_node').modal({
          autofocus: false,
          closable: false,
          onApprove: function() {
            //更新-扩展属性
            thisGraph.state.selectedNode.extendAttr = [];
            $('.extended_attr tbody tr').each(function() {
              var jsonstr = $(this).attr('jsonstr');
              thisGraph.state.selectedNode.extendAttr.push(jsonstr);
            });
            //更新-高级 属性
            thisGraph.state.selectedNode.highLevel = {};
            var highLevel = {};
            $('.prop_node .highLevel').find('input').each(function() {
              highLevel[$(this).attr('name')] = $(this).val();
            });
            thisGraph.state.selectedNode.highLevel = highLevel;
            //更新-超时限制
            $('.timeout_limit').find('input[name], select[name]').each(function() {
              thisGraph.state.selectedNode.timeoutLimit[$(this).attr('name')] = $(this).val();
            });
            thisGraph.state.selectedNode.timeoutLimit.deadline = [];
            $('.timeout_limit tbody tr').each(function() {
              var jsonstr = $(this).attr('jsonstr');
              thisGraph.state.selectedNode.timeoutLimit.deadline.push(jsonstr);
            });
            //更新-后置条件
            updatePostCondi('.post_condition');

            //更新-前置条件
            thisGraph.state.selectedNode.frontCondition = {};
            $('.front_condition > div:not(".hideDiv")').find('input:not(:radio)[name], select').each(function() {
              thisGraph.state.selectedNode.frontCondition[$(this).attr('name')] = $(this).val();
            });
            //更新-工具

            //更新-常规
            thisGraph.state.selectedNode.conventional = {};
            var conventional = {};
            $('.prop_node .conventional').find('input[name], textarea, select').each(function() {
              conventional[$(this).attr('name')] = $(this).val();
            });
            if (conventional.ID != selectedNode.id) {
              selectedNode.id = conventional.ID;
            }
            if (conventional.name != selectedNode.title) {
              selectedNode.title = conventional.name;
            }
            var $role = $('.conventional select[name="definition_role"]').parent();
            conventional.performer = $role.children('.text').attr('definition_id') || '';
            var role_txt = $role.dropdown('get text'); //Semantic存在bug，重构dropdown不能取value
            if (role_txt !='请选择' && role_txt !='(空)') {
              conventional.participantID = $role.dropdown('get text');
            }
            thisGraph.state.selectedNode.conventional = conventional;

          },
          onShow: function() {
            $('.prop_node .menu .item[data-tab="one"]').trigger('click');
            var node = thisGraph.state.selectedNode;
            //展示-监控信息
            $('.monitorinf select[name="isResponsibleTem"]').dropdown('set selected', node.monitorinf.isResponsibleTem);
            var responsible = node.monitorinf.responsible;

            if (responsible && responsible.length) {
              var tr = '';
              responsible.forEach(function(resp) {
                thisGraph.participants.forEach(function(participant) {
                  if (resp == participant.conventional_definition_id) {
                    tr += participant.conventional_definition_name?'<tr><td>'+(participant.conventional_definition_name+'-rol')+'</td></tr>':
                      '<tr><td>'+(resp+'-rol')+'</td></tr>';
                  }
                });
              });
              $('.monitorinf tbody').append(tr);
            }
            //展示-高级
            $('.highLevel').find('input').each(function() {
              for (var i in node.highLevel) {
                if ($(this).attr('name') == i) {
                  $(this).val(node.highLevel[i]);
                }
              }
            });
            //展示-超时限制
            $('.timeout_limit').find('input').each(function() {
              for (var i in node.timeoutLimit) {
                if ($(this).attr('name') == i) {
                  $(this).val(node.timeoutLimit[i]);
                }
              }
            });
            $('.timeout_limit').find('select').each(function() {
              for (var i in node.timeoutLimit) {
                if ($(this).attr('name') == i) {
                  $(this).dropdown('set selected', node.timeoutLimit[i]);
                }
              }
            });
            var deadline_strs = node.timeoutLimit.deadline;
            if (deadline_strs && deadline_strs.length) {
              var d_tr = '';
              deadline_strs.forEach(function(deadline_str){
                var deadline_obj = JSON.parse(deadline_str);
                d_tr += '<tr jsonstr= '+deadline_str+'><td>'+deadline_obj.deadlineCondition+'</td></tr>';
              });
              $('.timeout_limit tbody').append(d_tr);
            }
            //展示-扩展属性集
            var extendAttr_strs = node.extendAttr;
            if (extendAttr_strs && extendAttr_strs.length) {
              var e_tr = '';
              extendAttr_strs.forEach(function(extendAttr_str) {
                var extendAttr_obj = JSON.parse(extendAttr_str);
                var data = {
                  data: extendAttr_obj, 
                  jsonstr: extendAttr_str
                };
                e_tr += juicer($('#extended_attr_tpl').html(), data);
              });
              $('.extended_attr tbody').append(e_tr).find('.ui.checkbox').checkbox();
            }
            //展示-后置条件
            $('.post_condition .targetActivity').html($('#transition_tpl').html());
            $('.post_condition .targetActivity .menu .item').tab();
            $(".targetActivity .transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar();
            $('.targetActivity .conditionList,.conditionList2').mCustomScrollbar();
            var postCondition = {targetActivities: []};
            thisGraph.edges.filter(function(edge) {
              return (edge.source.type != 'start' && edge.target.type != 'end');
            }).forEach(function(edge) {
              if (edge.source == node) {
                postCondition.targetActivities.push({'activity': edge.target, 'transition': edge});
              }
            });
            if (postCondition.targetActivities.length > 0) {
              $('.post_condition .targetActivity').removeClass('hideDiv');
              $('.post_condition select[name="splitType"]').parent().removeClass('disabled');
              if (postCondition.targetActivities.length > 1) {
                var splitType = thisGraph.state.selectedNode.postCondition.splitType || 'XOR';
                $('.post_condition select[name="splitType"]').parent().dropdown('set selected', splitType);
              } else {
                $('.post_condition select[name="splitType"]').parent().addClass('disabled');
              }
              postCondition.targetActivities.forEach(function(targetActivity) {//目标活动展示
                $('.post_condition .list').append('<div class="item" acivityId="'+targetActivity.activity.id+'" jsonstr='+JSON.stringify(targetActivity.transition)+'>'+
                                                  '    <div class="content">'+
                                                  '        <div class="">'+targetActivity.activity.title+'</div>'+
                                                  '    </div>'+
                                                  '</div>');
              });
              $('.post_condition .list').on('click', '.item', function() {//点击目标活动
                $(this).addClass('active').siblings().removeClass('active');
                var transition = JSON.parse($(this).attr('jsonstr'));
                showTransition('.post_condition', transition);
              });
              $('.post_condition .list .item').eq(0).trigger('click');
            } else {
              $('.post_condition .targetActivity').addClass('hideDiv');
              $('.post_condition select[name="splitType"]').parent().addClass('disabled');
            }
            //展示-前置条件
            var frontCondition = node.frontCondition;
            if (frontCondition.convergeType) {
              $('.front_condition .dropdown.convergeType').dropdown('set selected', frontCondition.convergeType);
              $('.front_condition select[name="voteModel"]').dropdown('set selected', frontCondition.voteModel || "");
              $('.front_condition input[name="voteText"]').val(frontCondition.voteText || "");
              if (frontCondition.isCreateNew == "true") {
                $('.front_condition input[tabindex="true"]').parent().checkbox('check');
              } else if (frontCondition.isCreateNew == "false") {
                $('.front_condition input[tabindex="false"]').parent().checkbox('check');
              }
            }
            //展示-工具

            //展示-常规
            var conventional = node.conventional;
            $('.conventional').find('input[name], textarea').each(function() {
              for (var key in conventional) {
                if (key == $(this).attr('name')) {
                  $(this).val(conventional[key]);
                }
              }
            });
            $('.conventional').find('select').not($('input[name="definition_role"]')).each(function() {
              for (var key in conventional) {
                if (key == $(this).attr('name')) {
                  $(this).dropdown('set selected', conventional[key]);
                }
              }
            });
            $('.conventional').find('.checkbox').each(function() {
              var value = $(this).find('input[name]').val();
              if (value && value !="false") $(this).checkbox('check');
            });
            $('.conventional input[name="ID"]').val(node.id);
            $('.conventional input[name="name"]').val(node.title);
            if (conventional.performer) {
              $('.conventional select[name="definition_role"]').dropdown('set text', conventional.participantID || '');
              $('.conventional .dropdown .text').attr('definition_id', conventional.performer);
            }


            //监控信息-是否为临时监控
            $('.monitorinf select[name="isResponsibleTem"]').on('change', function() {
              var node = thisGraph.state.selectedNode;
              node.monitorinf.isResponsibleTem = $(this).val();
            });
            //常规-参与者集
            $('.conventional .definition_field').on('click', function() {
              var participants = thisGraph.participants;
              var options ='<option value="">请选择</option><option value="0">(空)</option>';
              participants.forEach(function(participant) {
                var rol = participant.conventional_definition_name ? participant.conventional_definition_name + "-rol" : participant.conventional_definition_id + "-rol";
                options += '<option value="' + participant.conventional_definition_id + '">' + rol + '</option>';
              });
              $('.conventional select[name="definition_role"]').empty().append(options);
            });
            //常规-参与者集-下拉菜单
            $('.conventional .definition_field').on('click', '.item', function() {
              var definition_id = $(this).attr('data-value') != "0" ? $(this).attr('data-value') : '';
              $('.conventional select[name="definition_role"]').siblings('.text').attr('definition_id', definition_id);
            });

          },
          onHidden: function() {
            $('.monitorinf select[name="isResponsibleTem"]').off('change'); //弹窗关闭，避免清空表单时触发事件
            $(this).find('input, textarea').val('');
            $(this).find('.ui.dropdown').dropdown('clear');
            $(this).find('.ui.checkbox').checkbox('uncheck');

            $('.monitorinf tbody').empty(); //清空监控信息
            $('.timeout_limit tbody').empty(); //清空监控信息
            $('.extended_attr tbody').empty(); //清空扩展属性集
            $('.post_condition .list').empty(); //清空后置条件

            $('.post_condition .targetActivity').html('');

            $('.conventional select[name="definition_role"]').siblings('.text').removeAttr('definition_id');

          }
        }).modal('show');
        
        $('.prop_node>.menu a[data-tab*="two"]').addClass('hideitem');
        if (selectedNode.title == '普通活动') {
          $('.prop_node>.menu a[data-tab="two_1"]').removeClass('hideitem');
        }
        if (selectedNode.title == '块活动') {
          $('.prop_node>.menu a[data-tab="two_2"]').removeClass('hideitem');
        }
        if (selectedNode.title == '子活动') {
          $('.prop_node>.menu a[data-tab="two_3"]').removeClass('hideitem');
        }
      } else if (item == 'propMenu' && selectedEdge) { //属性弹出层(连线)
        $('.prop_edge .targetActivity').html($('#transition_tpl').html());
        $('.prop_edge .targetActivity .menu .item').tab();
        $(".targetActivity .transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar();
        $('.targetActivity .conditionList,.conditionList2').mCustomScrollbar();
        $('.ui.modal.prop_edge').modal({
          autofocus: false,
          closable: false,
          onApprove: function() {
            //跟新-转移属性
            updatePostCondi('.prop_edge');
          },
          onShow: function() {
            var edge = thisGraph.state.selectedEdge;
            //展示-后置条件
            showTransition('.prop_edge', edge);
          },
          onHidden: function() {
            $('.prop_edge .targetActivity').html('');
          }
        }).modal('show');
      }
      $('#rMenu').hide();
    });
    //右击点击
    $('#container svg .graph').on('contextmenu', function(e) {
      e.preventDefault();
      $('#flowComponents div[name="selectBtn"]').trigger('click');
      $('#container .conceptG').css('cursor', 'default');//防止在活动块上右击存在问题
      $("#rMenu").css({
        "top": (e.clientY-2)+"px", 
        "left": (e.clientX-2)+"px"
      });
      var selectedNode = thisGraph.state.selectedNode,
        selectedEdge = thisGraph.state.selectedEdge;

      if (selectedNode) {
        if (selectedNode.type != 'activity') {
          $('#rMenu a[name="propMenu"]').hide();
        } else {
          $('#rMenu a[name="propMenu"]').show();
        }
        $("#rMenu").show();
      } else if (selectedEdge) {
        $("#rMenu").show();
      }
    });

    $('svg').on('click', function() {
      $('#rMenu').hide();
    });
    $('svg').on('contextmenu', function() {
      $('#flowComponents div[name="selectBtn"]').trigger('click');
      return false;
    });

    //后置条件-扩展属性集-添加
    $('.postCondition_extendAttr_add .green.button').on('click', function() {
      var name = $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_name"]').val();
      var value = $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_value"]').val();
      if (!name) {
        layer.msg('请输入名称！', {time: 2000, icon:2});
        return false;
      }
      if (!value) {
        layer.msg('请输入值！', {time: 2000, icon:2});
        return false;
      }
      var data = {name:name, value:value};
      data = {data:data, jsonstr:JSON.stringify(data)};
      var html = juicer($('#extended_attr_tpl').html(), data);
      var operate = $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_operate"]').val();
      if (operate) {
        var event_source = $(this).data('event_source');
        var selectedTr = $(event_source).find('.transferInf_extended_attr tbody tr.active');
        selectedTr.attr('jsonstr', data.jsonstr);
        selectedTr.find('td').eq(1).text(data.data.name);
        selectedTr.find('td').eq(2).text(data.data.value);
      } else {
        $('.targetActivity .transferInf_extended_attr tbody').append(html).find('.ui.checkbox').checkbox();
        $(".targetActivity .transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar("update");
        $(".targetActivity .transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar("scrollTo", "bottom", {
          scrollInertia: 1500
        });
      }
      $('.postCondition_extendAttr_add.modal input').val("");
    });

    //后置条件-扩展属性集-编辑
    $('.targetActivity').on('click', '.transferInf_extended_attr .extendAttrEditBtn', function() {
      var selectedTr = $(this).parents('.grid').find('tbody tr.active');
      if (selectedTr.length < 1) {layer.msg('请选择一行!', {time: 2000, icon: 0}); return false;}
      var jsonstr = $(this).parents('.grid').find('tbody tr.active').attr('jsonstr');
      var json = JSON.parse(jsonstr);
      $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_name"]').val(json.name);
      $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_value"]').val(json.value);
      $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_operate"]').val("1");
      $('.transferInf_extended_attr .extendAttrAddBtn').trigger('click');
    });
    //后置条件-扩展属性集-删除
    $('.targetActivity').on('click', '.transferInf_extended_attr .extendAttrDelBtn', function() {
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length > 0) {
        tr.remove();
        $(".transferInf_extended_attr .postCondi_extendedAttr").mCustomScrollbar("update");
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
      var data = {name:name, value:value};
      data = {data:data, jsonstr:JSON.stringify(data)};
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
        deadline[$(this).attr('name')] =$(this).val();
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
      var rol_id = $('.conventional select[name="definition_role"]').siblings('.text').attr('definition_id');
      if (rol_id) { // 编辑
        $('.conventional_definition input[name="conventional_def_operate"]').val(1);//页面标记 1：代表编辑
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
    $('.conventional_definition .definition_addBtn').on('click', function() {
      var typeName = $('.conventional_definition [data-tab="definition_2"]>.menu>.item.active').attr('value'),
        data_tab = $('.conventional_definition [data-tab="definition_2"] .tab.active').attr('data-tab'),
        type = $('.conventional_definition div[data-tab="'+data_tab+'"] select[name="definition_type"]').val(),
        name = $('.conventional_definition div[data-tab="'+data_tab+'"] [name="definition_name"]').val() || '';
      var params = {};
      $('.conventional_definition div[data-tab="'+data_tab+'"]').find('input[name],select').each(function() {
        params[$(this).attr('name')] = $(this).val();
      });
      if (data_tab == 'definition_2/a') {//类型--一般
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
        scrollInertia:1500
      });
    });

    //常规-定义-高级-删除条件
    $('.conventional_definition .definition_removeBtn').on('click', function() {
      var select = $('.conventional_definition .definition_condition tbody tr.active');
      if (select.length > 0) {
        select.remove();
        $(".definition_condition").mCustomScrollbar("update");
      } else {
        layer.msg('请选择一行!', {time: 2000, icon: 0});
      }
    });

    //常规-定义-确定
    $('.conventional_definition .green.button').on('click', function() {
      var operate = $('.conventional_definition input[name="conventional_def_operate"]').val(),
        currentId = $('.conventional_definition input[name="conventional_definition_id"]').val(),
        participant = {};
      $('.conventional_definition div[data-tab="definition_1"]').find('input[name]:not(".hidden"), textarea').each(function() {
        participant[$(this).attr('name')] = $(this).val();
      });
      if (participant.conventional_definition_participant) {//自定义参与者
        
      } else {
        $('.conventional_definition div[data-tab="definition_2"] tbody').find('tr').each(function() {
          $(this).find('td').each(function(){
            participant[$(this).attr('name')] = participant[$(this).attr('name')] || [];
            participant[$(this).attr('name')].push($(this).attr('value'));
          });
          participant.roleName = participant.roleName || [];
          participant.roleName.push('party');//常规定义参与者 角色默认是party
          //以下几个属性不知道从哪里获取...???
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

    //监控信息-增加-确定
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
        var value = $(this).find('.menu .item.selected').attr('data-value');//semantic-UI setmenu 存在bug, 无法取到值
        condition[$(this).children('select').attr('name')] = value;
      });

      if (!condition.key || condition.key == '0') {
        layer.msg('请选择方法！', {time: 2000, icon: 0});
        return false;
      }
      if (!condition.displayValue_one && !condition.displayValue_two) {//存在一个参考值即可
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
      names.forEach(function(item) {
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

    //后置条件-条件设置-类型(按业务对象转移)-关系设置-确定
    $('.relationshipPlacement .green.button').on('click', function() {
      var beanConditions_type = $('.relationshipPlacement input[name=beanConditions_type]').val();
      $('.workflowbeanDiv  input[name=beanConditions_type]').val(beanConditions_type);
    });
    

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

      condition.bean = condition.bean + ',personInfo';
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
    var extendAttr = node.extendAttr;
    var highLevel = node.highLevel;
    var highLevelXpdl = '',
      isCreateNew = '',
      voteModel = '',
      responsible = '';
    if (highLevel) {
      highLevelXpdl += highLevel.activityEndEvent?'<ExtendedAttribute Name="ActivityEndEvent" Value="'+highLevel.activityEndEvent+'"/>':'';
      highLevelXpdl += highLevel.activityCreateEvent?'<ExtendedAttribute Name="ActivityCreateEvent" Value="'+highLevel.activityCreateEvent+'"/>':'';
      highLevelXpdl += highLevel.finishRule?'<ExtendedAttribute Name="FinishRule" Value="'+highLevel.finishRule+'"/>':'<ExtendedAttribute Name="FinishRule"/>';
    } else {
      highLevelXpdl = '<ExtendedAttribute Name="deadline" />';
    }
    isCreateNew = node.frontCondition.isCreateNew?'<ExtendedAttribute Name="isCreateNew" Value="'+node.frontCondition.isCreateNew+'"/>':'';
    voteModel = node.frontCondition.voteModel!="0" && node.frontCondition.voteText?'<ExtendedAttribute Name="syncType" Value="'+node.frontCondition.voteModel+'|'+node.frontCondition.voteText+'"/>':'';
    responsible = node.monitorinf.responsible?'<ExtendedAttribute Name="responsible" Value="'+
                    node.monitorinf.responsible.join(',')+'"/>':'<ExtendedAttribute Name="responsible"/>';

    var ExtendedAttributes = 
            '<ExtendedAttributes>'+
                conventionalXpdl.isMulInstance+
            '   <ExtendedAttribute Name="isResponsibleTem" Value="'+node.monitorinf.isResponsibleTem+'"/>'+
                responsible+
                voteModel+
                conventionalXpdl.mustActivity+
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
    conventionalXpdl.taskAssignMode = '<ExtendedAttribute Name="taskAssignMode" Value="'+conventional.taskAssignMode+'"/>';
    conventionalXpdl.mustActivity = '<ExtendedAttribute Name="MustActivity" Value="'+conventional.mustActivity+'"/>';
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
    deadlineXpdl.deadline = deadlines_arr.length>0?'<ExtendedAttribute Name="deadline" Value="'+deadlines_arr.join('|')+'"/>':'<ExtendedAttribute Name="deadline"/>';
    return deadlineXpdl;
  };

  //获取activity进出线的数量
  GraphCreator.prototype.activityInOutNum = function(node) {
    var thisGraph = this;
    var numIn = 0,
      numOut = 0,
      transitionRefs = '',
      activity_inOut = {};
    var edges = thisGraph.edges;
    
    edges.forEach(function (edge) {
      var source = edge.source.component;
      var target = edge.target.component;
      if ( source != "startComponent" && target != "endComponent") {
        if (edge.source == node){
          numOut++;
          transitionRefs += '<TransitionRef Id="'+edge.edgeId+'"/>';
        } else if (edge.target == node){
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

  //生成所有activity xml添加至xpdlContainer
  GraphCreator.prototype.emergeAllxpdlContent = function() {
    var thisGraph = this;
    var nodes = thisGraph.nodes;
    var edges = thisGraph.edges;
    var activitySets = '';
    if (nodes.length > 0) {
      activitySets = //不清楚什么时候设置??应该是子流程
          '<ActivitySets>'+
          '   <ActivitySet Id="Package_8VRAH3EM_Wor1_Ase1"/>'+
          '</ActivitySets>';
    }

    var error = {
      messages: []
    };
    var activities = "",
      nodes_act = [],
      nodes_start = '',
      nodes_end = '';

    nodes.forEach(function(node) {
        if (node.type == 'activity') {
          nodes_act.push(node);
        }
        if (node.type == 'start') {
          edges.forEach(function(edge) {
            if (edge.source == node) {
              nodes_start += '<ExtendedAttribute Name="StartOfWorkflow" Value="'+node.id+';'+edge.target.id+';'+node.x+';'+node.y+';'+edge.drawLine+'"/>';
            }
          });
        }
        if (node.type == 'end') {
          edges.forEach(function(edge) {
            if (edge.target == node) {
              nodes_end += '<ExtendedAttribute Name="EndOfWorkflow" Value="'+node.id+';'+edge.source.id+';'+node.x+';'+node.y+';'+edge.drawLine +'"/>';
            }
          });
        }
    });
    nodes_act.forEach(function(node) {
      var activity_inOut = thisGraph.activityInOutNum(node);
      var deadlineXpdl = thisGraph.deadlineXpdl(node);
      var conventionalXpdl = thisGraph.conventionalXpdl(node);
      switch (node.component) {
        case "activityComponent"://普通活动
          activities += '<Activity Id="'+node.id+'" Name="'+node.title+'">'+
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
          activities += '<Activity Id="'+node.id+'" Name="'+node.title+'">' +
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
          activities += '<Activity Id="'+node.id+'" Name="'+node.title+'">' +
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
          activities += '<Activity Id="'+node.id+'" Name="'+node.title+'">' +
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
    var transitions = "";
    edges.filter(function (edge, index, self) {
      return (edge.source.type != 'start' && edge.target.type != 'end');
    }).forEach(function(edge) {
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
        condiException = '';
      if (conditype == 'CONDITION' || conditype == 'WORKFLOWBEAN') {
        condition = '<Condition Type="CONDITION"><![CDATA[()]]></Condition>';
      } else if (conditype) {
        condition = '<Condition Type="'+conditype+'"/>';
      } else {
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
    transitions = transitions?'<Transitions>' + transitions + '</Transitions>' : '';
    var str = '<WorkflowProcesses>' +
              '   <WorkflowProcess AccessLevel="PUBLIC" Id="'+workflow_id+'" Name="'+workflow_name+'">' +
              '       <ProcessHeader DurationUnit="D">' +
              '           <Created>'+creat_time+'</Created>' +
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
    if (nodes_act.length > 0) {
      str += '       <Activities>' +
                         activities +
             '       </Activities>';
    }
    
    str += transitions +
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
                       nodes_start +
                       nodes_end +
           '       </ExtendedAttributes>' +
           '   </WorkflowProcess>' +
           '</WorkflowProcesses>';
    str = vkbeautify.xml(str);
    return str;
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

  // 判断node有无连线
  GraphCreator.prototype.hasLinked = function(node) {
    var thisGraph = this;
    var hasLinked = false;
    thisGraph.edges.forEach(function(edge) {
      if (edge.source.id == node.id || edge.target.id == node.id) {
        hasLinked = true;
      }
    });
    return hasLinked;
  };

  /* PROTOTYPE FUNCTIONS */
  GraphCreator.prototype.dragmove = function(d) {
    var thisGraph = this;
    var drawLine = thisGraph.state.drawLine;
    var link;
    if (thisGraph.state.shiftNodeDrag || thisGraph.state.drawLine) {
      if (drawLine == 'NOROUTING') { // 直线
        link = thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
      }
      if (drawLine == 'SIMPLEROUTING') { // 折线
        var des = {
          x: d3.mouse(this.svgG.node())[0], 
          y: d3.mouse(this.svgG.node())[1]
        };
        var link_d = thisGraph.getLink_d(d, des);
        link = thisGraph.dragLine.attr('d', link_d);
      }
      refresh(link);//兼容IE11
    } else {
      d.x += d3.event.dx;
      d.y += d3.event.dy;
      thisGraph.updateGraph();
      /*
      //防止circle脱出svg范围(放大缩小后还存在问题，待修改...)
      var radius = thisGraph.consts.nodeRadius + thisGraph.consts.nodeRadiusVary,
        svg_width = $('svg').width(),
        svg_heigh = $('svg').height();
      d.x = Math.max(Math.min(d3.event.x, svg_width-radius), radius);
      d.y = Math.max(Math.min(d3.event.y, svg_heigh-radius), radius);
      thisGraph.updateGraph();*/
    }
  };

  GraphCreator.prototype.deleteGraph = function(skipPrompt) {
    var thisGraph = this;
    layer.confirm('确认清空？', {
      icon: 0,
      btn: ['确定','取消'], //按钮
      offset: '180px'
    }, function() {
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
      layer.msg('删除成功', {icon: 1, offset: '180px', time: 600});
    }, function() {
      
    });
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
  GraphCreator.prototype.insertTitleLinebreaks = function(gEl, title) {
    var words = title.split(/\s+/g),
      nwords = words.length;
    var el = gEl.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-" + (nwords - 1) * 7.5);

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

    d3.selectAll("div#inspector").remove();

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
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function(d3node, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;

    if (d3.event.shiftKey || thisGraph.state.drawLine) {
      if ( d.type == 'start') {
        if (thisGraph.hasLinked(d)) { 
          layer.msg('已有连线！', {time: 2000, icon: 0, offset: '180px'});
          return; 
        }
      }
      // Automatically create node when they shift + drag?
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      var link = thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
      refresh(link);//兼容IE11
      return;
    }
  };
  
  //更改属性div
  GraphCreator.prototype.changePropDiv = function(d){
    var thisGraph = this;
    $('.component-prop').empty().append(
        '<div>'+
        '  <div name="id" class="prop-value"><span>id:</span><span>'+d.id+'</span></div>'+
        '  <div name="name" class="prop-value"><span>名称:</span><span>'+d.title+'</span></div>'+
        '</div>'+
        '<div class="clearfix"></div>'+
        '<div> '+
        '  <div name="type" class="prop-value"><span>类型:</span><span>'+d.component+'</span></div>'+
        '  <div name="" class="prop-value"><span>执行者:</span><span>无</span></div>'+
        '</div>'+
        '<div class="clearfix"></div>');
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
      if (d.type == 'start') {// 连线指向开始
        layer.msg('不允许！', {time: 2000, icon: 0, offset: '180px'});
        return;
      }
      if (mouseDownNode.type == 'start') {
        if (thisGraph.hasLinked(mouseDownNode)) { 
          return; 
        }
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
        state.justDragged = false;
        if (state.selectedEdge) {
          thisGraph.removeSelectFromEdge();
        }
        if (!prevNode || prevNode.id !== d.id) {
          thisGraph.replaceSelectNode(d3node, d);
          thisGraph.changePropDiv(d);//添加更改属性div
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
          if (!prevNode || prevNode.id !== d.id) {
            thisGraph.replaceSelectNode(d3node, d);
            thisGraph.changePropDiv(d);//添加更改属性div
          } else {
            if(d3.event.button != '2'){
              thisGraph.removeSelectFromNode();
            }
          }
        }
      }
    }
    state.mouseDownNode = null;
    return;

  }; // end of circles mouseup

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
          component: 'activityComponent',
          type: 'activity',
          x: xycoords[0],
          y: xycoords[1],
          conventional: {
            mustActivity: true, 
            taskAssignMode: 'taskAutoMode', 
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
      state = thisGraph.state;

    thisGraph.paths = thisGraph.paths.data(thisGraph.edges, function(d) {
      return String(d.source.id) + "+" + String(d.target.id);
    });
    var paths = thisGraph.paths;
    // update existing paths
    var link = paths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function(d) {
        return d === state.selectedEdge;
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
    refresh(link);//兼容IE11

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end', 'url(#end-arrow)')
      .classed("link", true)
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
    thisGraph.circles = thisGraph.circles.data(thisGraph.nodes, function(d) {
      return d.id;
    });
    thisGraph.circles.attr("transform", function(d) {
      return "translate(" + d.x + "," + d.y + ")";
    });

    // add new nodes
    var newGs = thisGraph.circles.enter()
      .append("g")
        .attr({"id": function(d){ return generateUUID(); }});

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
      thisGraph.insertTitleLinebreaks(d3.select(this), d.title);
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
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + translate + ") scale(" + scale + ")");
  };

  GraphCreator.prototype.updateWindow = function(svg) {
    var docEl = document.documentElement,
      bodyEl = document.getElementsByTagName('body')[0];
    var x = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth;
    var y = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;
    svg.attr("width", x).attr("height", y);
  };



  /**** MAIN ****/

  // warn the user when leaving
  window.onbeforeunload = function() {
    //return "Make sure to save your graph locally before leaving :-)";
  };

  var docEl = document.documentElement,
    bodyEl = document.getElementsByTagName('body')[0];

  var width = window.innerWidth || docEl.clientWidth || bodyEl.clientWidth,
    height = window.innerHeight || docEl.clientHeight || bodyEl.clientHeight;

  var xLoc = width / 2 - 25,
      yLoc = 100;

  // initial node data
  var nodes = [{
    title: "Process Map Step 1",
    id: 0,
    x: xLoc,
    y: yLoc,
    eventTypeId: null
  }, {
    title: "Process Map Step 2",
    id: 1,
    x: xLoc,
    y: yLoc + 200,
    eventTypeId: null
  }];
  var edges = [{
    source: nodes[0],
    target: nodes[1]
  }];

  /** MAIN SVG **/
  var svg = d3.select("div#container").append("svg")
    // .attr("width", width)
    // .attr("height", height);
    .attr("width", "100%")
    .attr("height", "100%");
  var graph = new GraphCreator(svg, [], []);
  // graph.setIdCt(0);
  graph.updateGraph();

})(window.d3, window.saveAs, window.Blob, vkbeautify);

/**
 * svg
 * refresh 连线兼容IE11
 * @param  {[type]} link [改变attr后的dragLine]
 */
function refresh(link) {
  if (/(MSIE 10)|(Trident)/.test(navigator.appVersion)) {
    if (link[0] instanceof Array) {
      link[0].forEach(function(item) {
        item.parentNode.insertBefore(item, item);
      });
    } else if (link[0]) {
      var svgNode = link.node();
      svgNode.parentNode.insertBefore(svgNode, svgNode);
    }
  }
}
