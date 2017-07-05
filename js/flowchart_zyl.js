document.onload = (function(d3, saveAs, Blob, vkbeautify) {
  "use strict";

  // define graphcreator object
  var GraphCreator = function(svg, nodes, edges, participants) {
    var thisGraph = this;
    console.log('thisGraph:');
    console.log(thisGraph);

    thisGraph.idct = 0;
    thisGraph.edgeNum = 1;

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
      drawLine: false
    };

    // define arrow markers for graph links
    var defs = svg.append('defs');
    defs.append('svg:marker')
      .attr('id', 'end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', "32")
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    //define arrow markers for leading arrow
    defs.append('marker')
      .attr('id', 'mark-end-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 7)
      .attr('markerWidth', 3.5)
      .attr('markerHeight', 3.5)
      .attr('orient', 'auto')
      .append('svg:path')
      .attr('d', 'M0,-5L10,0L0,5');

    thisGraph.svg = svg;
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
      .on("drag", function(args) {
        thisGraph.state.justDragged = true;
        thisGraph.dragmove.call(thisGraph, args);
      })
      .on("dragend", function(args) {
        // args = circle that was dragged
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

    // listen for dragging
    var dragSvg = d3.behavior.zoom()
      .on("zoom", function() {
        console.log('zoom triggered');
        if (d3.event.sourceEvent.shiftKey) {
          // the internal d3 state is still changing
          return false;
        } else {
          thisGraph.zoomed.call(thisGraph);
        }
        return true;
      })
      .on("zoomstart", function() {
        var ael = d3.select("#" + thisGraph.consts.activeEditId).node();
        if (ael) {
          ael.blur();
        }
        if (!d3.event.sourceEvent.shiftKey) d3.select('body').style("cursor", "move");
      })
      .on("zoomend", function() {
        d3.select('body').style("cursor", "auto");
      });

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
              .attr('transform', "translate(1,0)");

      dragSvg.scale(1);
      dragSvg.translate([1,0]);
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
            thisGraph.setIdCt(jsonObj.nodes.length + 1);
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

    $('#flowComponents .components-btn[type]').not('.noComponent').attr('draggable', 'true').on('dragstart', function(ev) {
      $(this).siblings().removeClass('active').end().addClass('active');
      ev.originalEvent.dataTransfer.setData('text', $(this).children('span').text());
      ev.originalEvent.dataTransfer.setData('shapename', $(this).attr('for-name'));
      ev.originalEvent.dataTransfer.setData('component', $(this).attr('name'));
      ev.originalEvent.dataTransfer.setData('type', $(this).attr('type'));
      // $('#reset-zoom').trigger("click");
    });
    $('#container').on('drop', function(ev) {
      var position ={};
      position.x = parseInt(ev.originalEvent.offsetX),
      position.y = parseInt(ev.originalEvent.offsetY);
      // var xycoords = d3.mouse(thisGraph.svgG.node());
      var shapeLabel = ev.originalEvent.dataTransfer.getData('text'),
        shapename = ev.originalEvent.dataTransfer.getData('shapename'),
        component = ev.originalEvent.dataTransfer.getData('component'),
        type = ev.originalEvent.dataTransfer.getData('type'),
        shapeId = shapename + new Date().getTime(),
        isCreate = true;
      var d = {
          id: Word+'_node_'+randomWord(false, 4)+thisGraph.idct++,
          title: shapeLabel,
          component: component,
          type: type,
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
          extendAttr: [],
          highLevel: {},
          timeoutLimit: {},
          monitorinf: {isResponsibleTem: true},
          eventTypeId: null
        };
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
    }).on('dragover', function(ev) {
      ev.preventDefault();
    });
    //选择左侧工具
    $('#flowComponents .components-btn').on('click', function() {
      $(this).siblings().removeClass('active').end().addClass('active');
      if('drawLineBtn'==$(this).attr('name')){
        thisGraph.state.drawLine = true;
        $('#container').on('mouseover mouseout', '.conceptG', function() {
          if(event.type == 'mouseover'){
            this.style.cursor = 'crosshair';
          }else if(event.type == 'mouseout'){
            this.style.cursor = 'default';
          }
        });
      }else{
        $('#container').off('mouseover mouseout', '.conceptG');
        thisGraph.state.drawLine = false;
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

              for (var i in json.edges) {
                var source = json.edges[i].source.id;
                var target = json.edges[i].target.id;
                var edge = {};
                edge.edgeId = json.edges[i].edgeId;
                for (var j in json.nodes) {
                  var node = json.nodes[j].id
                  if (source == node) edge.source = nodes[j];
                  if (target == node) edge.target = nodes[j];
                }
                edges.push(edge);
              }
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
    });
    //右击菜单
    $('#rMenu .item').on('click', function() {
      var item = $(this).attr('name');
      var selectedNode = thisGraph.state.selectedNode,
      selectedEdge = thisGraph.state.selectedEdge;
      if (item == 'removeMenu') {
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
      }
      if (item == 'toFront') {
        alert('前置');
      }
      //属性弹出层
      if (item == 'propMenu') {
        $('.ui.modal.prop_layer').modal({
          autofocus: false,
          closable: false,
          onApprove: function() {
            //更新-扩展属性
            thisGraph.state.selectedNode.extendAttr = [];
            $('.extended_attr tbody tr').each(function() {
              var jsonstr = $(this).attr('jsonstr');
              thisGraph.state.selectedNode.extendAttr.push(jsonstr);
            })
            //更新-高级 属性
            thisGraph.state.selectedNode.highLevel = {};
            var highLevel = {};
            $('.prop_layer .highLevel').find('input').each(function() {
              highLevel[$(this).attr('name')] = $(this).val();
            })
            thisGraph.state.selectedNode.highLevel = highLevel;
            //更新-超时限制
            $('.timeout_limit').find('input[name], select[name]').each(function() {
              thisGraph.state.selectedNode.timeoutLimit[$(this).attr('name')] = $(this).val();
            })
            thisGraph.state.selectedNode.timeoutLimit.deadline = [];
            $('.timeout_limit tbody tr').each(function() {
              var jsonstr = $(this).attr('jsonstr');
              thisGraph.state.selectedNode.timeoutLimit.deadline.push(jsonstr);
            })
            //更新-后置条件
            
            //更新-前置条件
            thisGraph.state.selectedNode.frontCondition = {};
            $('.front_condition > div:not(".hideDiv")').find('input:not(:radio)[name], select').each(function() {
              thisGraph.state.selectedNode.frontCondition[$(this).attr('name')] = $(this).val();
            })
            //更新-工具

            //更新-常规
            thisGraph.state.selectedNode.conventional = {};
            var conventional = {};
            $('.prop_layer .conventional').find('input[name], textarea, select').each(function() {
              conventional[$(this).attr('name')] = $(this).val();
            })
            if (conventional.ID != selectedNode.id) {
              selectedNode.id = conventional.ID;
            }
            if (conventional.name != selectedNode.title) {
              selectedNode.title = conventional.name;
            }
            var $role = $('.conventional select[name="definition_role"]');
            if ($role.dropdown('get text')[0] != '(空)') {
              conventional.performer = $role.siblings('.text').attr('definition_id');
              conventional.participantID = $role.dropdown('get text')[0];
            } else {
              conventional.performer = '';
              conventional.participantID = '';
            }

            thisGraph.state.selectedNode.conventional = conventional;

          },
          onShow: function() {
            var node = thisGraph.state.selectedNode;
            //展示-监控信息
            var participants = thisGraph.participants;
            $('.monitorinf select[name="isResponsibleTem"]').dropdown('set selected', node.monitorinf.isResponsibleTem);
            var responsible = node.monitorinf.responsible;

            if (responsible && responsible.length) {
              var tr = '';
              for (var i in responsible) {
                for (var j in participants) {
                  if (responsible[i] == participants[j].conventional_definition_id) {
                    tr += participants[j].conventional_definition_name?'<tr><td>'+(participants[j].conventional_definition_name+'-rol')+'</td></tr>':'<tr><td>'+(responsible[i]+'-rol')+'</td></tr>';
                  }
                }
              }
              $('.monitorinf tbody').append(tr);
            }
            //展示-高级
            $('.highLevel').find('input').each(function() {
              for (var i in node.highLevel) {
                if ($(this).attr('name') == i) {
                  $(this).val(node.highLevel[i]);
                }
              }
            })
            //展示-超时限制
            $('.timeout_limit').find('input').each(function() {
              for (var i in node.timeoutLimit) {
                if ($(this).attr('name') == i) {
                  $(this).val(node.timeoutLimit[i]);
                }
              }
            })
            $('.timeout_limit').find('select').each(function() {
              for (var i in node.timeoutLimit) {
                if ($(this).attr('name') == i) {
                  $(this).dropdown('set selected', node.timeoutLimit[i]);
                }
              }
            })
            var deadline_strs = node.timeoutLimit.deadline;
            if (deadline_strs && deadline_strs.length) {
              var tr = '';
              for (var i in deadline_strs) {
                var deadline_obj = JSON.parse(deadline_strs[i]);
                tr += '<tr jsonstr= '+deadline_strs[i]+'><td>'+deadline_obj.deadlineCondition+'</td></tr>';
              }
              $('.timeout_limit tbody').append(tr);
            }
            //展示-扩展属性集
            var extendAttr_strs = node.extendAttr;
            if (extendAttr_strs && extendAttr_strs.length) {
              var tr = '';
              for (var i in extendAttr_strs) {
                var extendAttr_obj = JSON.parse(extendAttr_strs[i]);
                var data = {
                  data: extendAttr_obj, 
                  jsonstr: extendAttr_strs[i]
                };
                tr += juicer($('#extended_attr_tpl').html(), data);
              }
              $('.extended_attr tbody').append(tr).find('.ui.checkbox').checkbox();
            }
            //展示-后置条件
            var postCondition = {};
            thisGraph.edges.forEach(function(edge) {
              if (edge.source == node) {
                postCondition.targetActivities = postCondition.targetActivities || [];
                postCondition.targetActivities.push({'activity': edge.target, 'transition': edge});
              }
            });
            postCondition.targetActivities && postCondition.targetActivities.forEach(function(targetActivity) {
              $('.post_condition .list').append('<div class="item" acivityId="'+targetActivity.activity.id+'" jsonstr='+JSON.stringify(targetActivity.transition)+'>'+
                                                '    <div class="content">'+
                                                '        <div class="">'+targetActivity.activity.title+'</div>'+
                                                '    </div>'+
                                                '</div>');
            });
            $('.post_condition .list').on('click', '.item', function() {
              $(this).addClass('active').siblings().removeClass('active');
              var transition = JSON.parse($(this).attr('jsonstr'));
              //清空 转移信息/条件设置/事件
              $('.post_condition .tab').find('input, textarea').val('');
              $('.post_condition .tab').find('select').dropdown('clear');

              $('.post_condition input[name="edgeId"]').val(transition.edgeId);
              $('.post_condition input[name="edgeName"]').val(transition.edgeName || '');
              $('.post_condition input[name="source"]').val(transition.source.title);
              $('.post_condition input[name="target"]').val(transition.target.title);
              $('.post_condition textarea[name="description"]').val(transition.description || '');
              //遍历扩展属性
              

            });
            $('.post_condition .list .item').eq(0).trigger('click');
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
                  $(this).dropdown('set selected', conventional[key])
                }
              }
            });
            $('.conventional').find('.checkbox').each(function() {
              var value = $(this).find('input[name]').val();
              if (value && value !="false") $(this).checkbox('check');
            })
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
            })

          },
          onHidden: function() {
            $('.monitorinf select[name="isResponsibleTem"]').off('change'); //弹窗关闭，避免清空表单时触发事件
            $(this).find('input, textarea').val('');
            $(this).find('.ui.dropdown').dropdown('clear');
            $(this).find('.ui.checkbox').checkbox('uncheck');

            $('.monitorinf tbody').empty(); //清空监控信息
            $('.timeout_limit tbody').empty(); //清空监控信息
            $('.extended_attr tbody').empty(); //清空扩展属性集
            $('.post_condition tbody').empty(); //清空后置条件
            $('.post_condition .list').empty(); //清空后置条件

            $('.conventional select[name="definition_role"]').siblings('.text').removeAttr('definition_id');

            $('.prop_layer .menu .item[data-tab="one"]').trigger('click');
          }
        }).modal('show');
        
        $('.prop_layer>.menu a[data-tab*="two"]').addClass('hideitem');
        if (selectedNode.title == '普通活动') {
          $('.prop_layer>.menu a[data-tab="two_1"]').removeClass('hideitem');
        }
        if (selectedNode.title == '块活动') {
          $('.prop_layer>.menu a[data-tab="two_2"]').removeClass('hideitem');
        }
        if (selectedNode.title == '子活动') {
          $('.prop_layer>.menu a[data-tab="two_3"]').removeClass('hideitem');
        }
      }
      $('#rMenu').hide();
    });
    //右击点击
    $('#container svg .graph').on('contextmenu', function(e) {
      $('#flowComponents div[name="selectBtn"]').trigger('click');
      $('#container .conceptG').css('cursor', 'default');//防止在活动块上右击存在问题
      $("#rMenu").css({"top":(event.clientY-2)+"px", "left":(event.clientX-2)+"px"});
      var selectedNode = thisGraph.state.selectedNode;
      if (selectedNode.type != 'activity') {
        $('#rMenu a[name="propMenu"]').hide();
      } else {
        $('#rMenu a[name="propMenu"]').show();
      }
      $("#rMenu").show();
      return false;
    })

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
      data = {data:data, jsonstr:JSON.stringify(data)}
      var html = juicer($('#extended_attr_tpl').html(), data);
      var operate = $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_operate"]').val();
      if (operate) {
        var selectedTr = $('.transferInf_extended_attr tbody tr.active');
        selectedTr.attr('jsonstr', data.jsonstr);
        selectedTr.find('td').eq(1).text(data.data.name);
        selectedTr.find('td').eq(2).text(data.data.value);
      } else {
        $('.transferInf_extended_attr tbody').append(html).find('.ui.checkbox').checkbox();
        $(".transferInf_extended_attr .content-div").mCustomScrollbar("update");
        $(".transferInf_extended_attr .content-div").mCustomScrollbar("scrollTo", "bottom", {
          scrollInertia: 1500
        });
      }
      $('.postCondition_extendAttr_add.modal input').val("");
    })
    //后置条件-扩展属性集-编辑
    $('.transferInf_extended_attr .extendAttrEditBtn').on('click', function() {
      var selectedTr = $(this).parents('.grid').find('tbody tr.active');
      if (selectedTr.length<1) {layer.msg('请选择一行!', {time: 2000, icon:0});return false}
      var jsonstr = $(this).parents('.grid').find('tbody tr.active').attr('jsonstr');
      var json = JSON.parse(jsonstr);
      $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_name"]').val(json.name);
      $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_value"]').val(json.value);
      $('.postCondition_extendAttr_add.modal input[name="extendAttr_add_operate"]').val("1");
      $('.transferInf_extended_attr .extendAttrAddBtn').trigger('click');
    })
    //后置条件-扩展属性集-删除
    $('.transferInf_extended_attr .extendAttrDelBtn').on('click', function() {
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length > 0) {
        tr.remove();
        $(".transferInf_extended_attr .content-div").mCustomScrollbar("update");
      } else {
        layer.msg('请选择一行!', {time: 2000, icon:0});
      }
    })

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
      data = {data:data, jsonstr:JSON.stringify(data)}
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
    })
    //扩展属性集-编辑
    $('.extended_attr .extendAttrEditBtn').on('click', function() {
      var selectedTr = $(this).parents('.grid').find('tbody tr.active');
      if (selectedTr.length<1) {layer.msg('请选择一行!', {time: 2000, icon:0});return false}
      var jsonstr = $(this).parents('.grid').find('tbody tr.active').attr('jsonstr');
      var json = JSON.parse(jsonstr);
      $('.extendAttr_add.modal input[name="extendAttr_add_name"]').val(json.name);
      $('.extendAttr_add.modal input[name="extendAttr_add_value"]').val(json.value);
      $('.extendAttr_add.modal input[name="extendAttr_add_operate"]').val("1");
      $('.extended_attr .extendAttrAddBtn').trigger('click');
      // $('.extendAttr_add.modal').modal('show'); //会关闭一级弹窗
    })
    //扩展属性集-删除
    $('.extended_attr .extendAttrDelBtn').on('click', function() {
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length > 0) {
        tr.remove();
      } else {
        layer.msg('请选择一行!', {time: 2000, icon:0});
      }
    })
    //超时限制-增加-确定
    $('.timeoutLimit_add .green.button').on('click', function() {
      var deadline = {};
      $('.timeoutLimit_add').find('input[name], select').each(function() {
        deadline[$(this).attr('name')] =$(this).val();
      })
      if (!deadline.deadlineCondition) {
        layer.msg('请输入持续时间！', {time: 2000, icon:2});
        return false;
      }
      if (!deadline.exceptionName) {
        layer.msg('请输入异常名称！', {time: 2000, icon:2});
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
    })
    //超时限制-删除
    $('.timeoutLimitRemoveBtn').on('click', function() {
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length > 0) {
        tr.remove();
        $(".timeout_limit_grid .content-div").mCustomScrollbar("update");
      } else {
        layer.msg('请选择一行!', {time: 2000, icon:0});
      }
    })
    //超时限制-编辑
    $('.timeoutLimitEditBtn').on('click', function(){
      var tr = $(this).parents('.grid').find('tbody tr.active');
      if (tr.length == 0) {
        layer.msg('请选择一行!', {time: 2000, icon:0});
        return false;
      }
      var data = JSON.parse(tr.attr('jsonstr'));
      for (var item in data) {
        $('.timeoutLimit_add').find('input[name="'+item+'"]').val(data[item]);
      }
      $('.timeoutLimit_add').find('select').dropdown('set selected', data.execution);
      $('.timeoutLimit_add.modal input[name="timeoutLimit_add_operate"]').val("1");
      $('.timeoutLimitAddBtn').trigger('click');
    })
    //常规-定义
    $('.conventional').on('click', '.definitionBtn', function(event) {
      var rol_id = $('.conventional select[name="definition_role"]').siblings('.text').attr('definition_id');
      // var rol_id = $('.conventional select[name="definition_role"]').dropdown('get value');
      if (rol_id) { // 编辑
        $('.conventional_definition input[name="conventional_def_operate"]').val(1);//页面标记 1：代表编辑
        var participants = thisGraph.participants;
        for (var i in participants) {
          if (participants[i].conventional_definition_id == rol_id) {
            var participant = participants[i];
            $('.conventional_definition div[data-tab="definition_1"]').find('input[name]:not(".hidden"), textarea').each(function() {
              $(this).val(participant[$(this).attr('name')]);
            });
            for (var j in participant.typeName) {
              $('.conventional_definition .definition_condition tbody').append(
                  '<tr>'+
                  '  <td name="typeName">'+participant.typeName[j]+'</td>'+
                  '  <td name="itemName">'+participant.itemName[j]+'</td>'+
                  '  <td name="itemValue">'+participant.itemValue[j]+'</td>'+
                  '  <td name="secLevelS">'+participant.secLevelS[j]+'</td>'+
                  '  <td name="secLevelE">'+participant.secLevelE[j]+'</td>'+
                  '  <td name="roleName">'+participant.roleName[j]+'</td>'+
                  '</tr>');
            }
          }
        }
      } else { //增加
        $('.conventional_definition input[name="conventional_definition_id"]').val(workflow_id + "_Par" + conventional_par);
        conventional_par++;
      }
    });
    
    
    //常规-定义-高级-增加条件
    $('.conventional_definition .definition_addBtn').on('click', function() {
      var typeName = $('.conventional_definition [data-tab="definition_2"]>.menu>.item.active').text(),
        data_tab = $('.conventional_definition [data-tab="definition_2"] .tab.active').attr('data-tab'),
        type = $('.conventional_definition div[data-tab="'+data_tab+'"] select[name="definition_type"]').val(),
        name = $('.conventional_definition div[data-tab="'+data_tab+'"] input[name="definition_name"]').val();
      var params = {};
      $('.conventional_definition div[data-tab="'+data_tab+'"]').find('input[name],select').each(function() {
        params[$(this).attr('name')] = $(this).val();
      })
      if (data_tab == 'definition_2/a') {//类型--一般
        if (!type||!name) {
          layer.msg('请选择类型和名称!', {time: 2000, icon: 2});
          return false;
        }
      } else {
        if (!type) {
          layer.msg('请选择类型!', {time: 2000, icon: 2});
          return false;
        }
      }

      var definition_type = '';
      if (data_tab == 'definition_2/a') {
        definition_type = params.definition_type==1? "部门【部门】":params.definition_type==2? "部门【人】":params.definition_type==3? "部门【默认】":params.definition_type==4? "部门【领导】":params.definition_type==5? "角色【人】":params.definition_type==6? "角色【角色】":params.definition_type==7? "所有人【人】":"";
      } else if (data_tab == 'definition_2/b') {
        definition_type = params.definition_type==1? "创建人本人":params.definition_type==2? "创建人领导":params.definition_type==3? "创建人下属":params.definition_type==4? "创建人部门人员":params.definition_type==5? "创建人部门领导":"";
      } else if (data_tab == 'definition_2/c') {
        definition_type = params.definition_type==1? "发送人本人":params.definition_type==2? "发送人领导":params.definition_type==3? "发送人下属":params.definition_type==4? "发送人部门人员":params.definition_type==5? "发送人部门领导":"";
      } else if (data_tab == 'definition_2/d') {
        definition_type = params.definition_type==1? "前一环节创建人本人":params.definition_type==2? "前一环节创建人上级":"";
      } else if (data_tab == 'definition_2/e') {
        definition_type = params.definition_type==1? "处理人本人":params.definition_type==2? "处理人上级":params.definition_type==3? "处理人下属":params.definition_type==4? "处理人部门人员":params.definition_type==5? "处理人部门领导":"";
      }
      $('.conventional_definition [name="conventional_definition_participant"]').val("");//清除-自定义参数者
      $('.conventional_definition .definition_condition tbody').append(
                '<tr>'+
                '  <td name="typeName">'+typeName+'</td>'+
                '  <td name="itemName">'+definition_type+'</td>'+
                '  <td name="itemValue">'+(params.definition_name? params.definition_name:"")+'</td>'+
                '  <td name="secLevelS">'+params.definition_param1+'</td>'+
                '  <td name="secLevelE">'+params.definition_param2+'</td>'+
                '  <td name="condition"></td>'+
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
        layer.msg('请选择一行!', {time: 2000, icon: 2});
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
            participant[$(this).attr('name')].push($(this).text());
          });
          participant['roleName'] = participant['roleName'] || []
          participant['roleName'].push('party');//常规定义参与者 角色默认是party
        });
      }

      if (operate) {// 1：编辑
        for (var i in thisGraph.participants) {
          var p = thisGraph.participants[i];
          if (p.conventional_definition_id == currentId) {
            thisGraph.participants[i] = participant;
          }
        }
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
        for (var i in responsible) {
          if (responsible[i] == definition_id) responsible.splice(i, 1);
        }
        selected.remove();
        $(".monitorinf_grid .content-div").mCustomScrollbar("update");
      } else {
        layer.msg('请选择一行', {time: 2000, icon: 2});
      }
    });
    //监控信息-编辑
    $('.monitorinf .monitorinfEditBtn').on('click', function() {
      var selected = $('.monitorinf').find('tbody tr.active');
      if (selected.length) {
        var rol = selected.find('td').text()
        $('.monitorinf_add input[name="monitorinf_add_operate"]').val(1);
        $('.monitorinf_add select[name="definition_role"]').dropdown('set text', rol);
        $(this).siblings('.monitorinfAddBtn').trigger('click');
      } else {
        layer.msg('请选择一行', {time: 2000, icon: 2});
      }
    })
    //监控信息-增加-定义
    $('.monitorinf_add .definitionBtn').on('click', function() {
      var operate = $('.monitorinf_add input[name="monitorinf_add_operate"]').val();
      if (operate) { // 编辑
        var rol = $('.monitorinf_add .dropdown .text').attr('definition_id').replace('-rol', '');
        $('.monitorinfAddDefinition input[name="monitorinf_add_operate"]').val(operate);//隐藏域：1代表编辑 空代表增加
        var monitorinf = thisGraph.state.selectedNode.monitorinf;
        var participants = thisGraph.participants;
        for (var i in participants) {
          if (participants[i].conventional_definition_id == rol) {
            var participant = participants[i];
            $('.monitorinfAddDefinition div[data-tab="definition_one"]').find('input[name]:not(".hidden"), textarea').each(function() {
              $(this).val(participant[$(this).attr('name')]);
            });
            $('.monitorinfAddDefinition div[data-tab="definition_one"]').find('select').each(function() {
              $(this).dropdown('set selected', participant[$(this).attr('name')]);
            });
            for (var j in participant.typeName) {
              $('.monitorinfAddDefinition .definition_condition tbody').append(
                  '<tr>'+
                  '  <td name="typeName">'+participant.typeName[j]+'</td>'+
                  '  <td name="itemName">'+participant.itemName[j]+'</td>'+
                  '  <td name="itemValue">'+participant.itemValue[j]+'</td>'+
                  '  <td name="secLevelS">'+participant.secLevelS[j]+'</td>'+
                  '  <td name="secLevelE">'+participant.secLevelE[j]+'</td>'+
                  '  <td name="roleName">'+participant.roleName[j]+'</td>'+
                  '</tr>');
            }
          }
        }
      } else { //增加
        $('.monitorinfAddDefinition input[name="conventional_definition_id"]').val(workflow_id +"_Par"+ conventional_par);
        conventional_par++;
      }
    })
    //监控信息-增加-定义-高级-增加条件
    $('.monitorinfAddDefinition .monitorinfDefintionAddBtn').on('click', function() {
      var typeName = $('.monitorinfAddDefinition [data-tab="definition_two"]>.menu>.item.active').text(),
        data_tab = $('.monitorinfAddDefinition [data-tab="definition_two"] .tab.active').attr('data-tab'),
        type = $('.monitorinfAddDefinition div[data-tab="'+data_tab+'"] select[name="definition_type"]').val(),
        name = $('.monitorinfAddDefinition div[data-tab="'+data_tab+'"] input[name="definition_name"]').val();
      var params = {};
      $('.monitorinfAddDefinition div[data-tab="'+data_tab+'"]').find('input[name],select').each(function(){
        params[$(this).attr('name')] = $(this).val();
      })
      if (data_tab == 'definition_two/a') {//类型--一般
        if (!type || !name) {
          layer.msg('请选择类型和名称!', {time: 2000, icon: 2});
          return false;
        }
      } else {
        if (!type) {
          layer.msg('请选择类型!', {time: 2000, icon: 2});
          return false;
        }
      }
      var definition_type = '';
      if (data_tab == 'definition_two/a') {
        definition_type = params.definition_type==1? "部门【部门】":params.definition_type==2? "部门【人】":params.definition_type==3? "部门【默认】":params.definition_type==4? "部门【领导】":params.definition_type==5? "角色【人】":params.definition_type==6? "角色【角色】":params.definition_type==7? "所有人【人】":"";
      } else if (data_tab == 'definition_two/b') {
        definition_type = params.definition_type==1? "当前处理人领导":params.definition_type==2? "当前处理人部门领导":"";
      } else if (data_tab == 'definition_two/c') {
        definition_type = params.definition_type==1? "发送人本人":params.definition_type==2? "发送人领导":params.definition_type==3? "发送人下属":params.definition_type==4? "发送人部门人员":params.definition_type==5? "发送人部门领导":"";
      } else if (data_tab == 'definition_two/d') {
        definition_type = params.definition_type==1? "前一环节创建人本人":params.definition_type==2? "前一环节创建人上级":"";
      } 
      $('.monitorinfAddDefinition [name="conventional_definition_participant"]').val("");//清除-自定义参数者
      $('.monitorinfAddDefinition .definition_condition tbody').append(
                '<tr>'+
                '  <td name="typeName">'+typeName+'</td>'+
                '  <td name="itemName">'+definition_type+'</td>'+
                '  <td name="itemValue">'+(params.definition_name? params.definition_name:"")+'</td>'+
                '  <td name="secLevelS">'+params.definition_param1+'</td>'+
                '  <td name="secLevelE">'+params.definition_param2+'</td>'+
                '  <td name="roleName">'+params.definition_role+'</td>'+
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
        layer.msg('请选择一行!', {time: 2000, icon: 2});
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
          participant[$(this).attr('name')].push($(this).text());
        });
      });
      
      if (operate) {// 1：编辑
        for (var i in thisGraph.participants) {
          var p = thisGraph.participants[i];
          if (p.conventional_definition_id == currentId) {
            thisGraph.participants[i] = participant;
          }
        }
      } else {// '':保存
        thisGraph.participants.push(participant);
      }

      var rol = participant.conventional_definition_name?participant.conventional_definition_name + "-rol":participant.conventional_definition_id + "-rol";
      $('.monitorinf_add select[name="definition_role"]').dropdown('set text', rol);
      $('.monitorinf_add .dropdown .text').attr('definition_id', participant.conventional_definition_id);
    });
    //监控信息-增加-确定
    $('.monitorinf_add .green.button').on('click', function() {
      var operate = $('.monitorinf_add input[name="monitorinf_add_operate"]').val();//operate:1为编辑
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
    })
    //后置条件-条件设置-类型
    $('.post_condition select[name=conditype]').on('change', function(){
      var show_cls = '.'+$(this).val().toLowerCase()+'Div';
      var show_div = $(this).parents('.fields').siblings(show_cls);
      if (show_div.length) {
        show_div.removeClass('hideDiv').siblings('.myitem').addClass('hideDiv');
      } else {
        $(this).parents('.fields').siblings('.myitem').addClass('hideDiv');
      }
    })

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
      highLevelXpdl += highLevel.finishRule?'<ExtendedAttribute Name="FinishRule" Value="'+highLevel.finishRule+'"/>':'';
    } else {
      highLevelXpdl = '<ExtendedAttribute Name="deadline" />'
    }
    isCreateNew = node.frontCondition.isCreateNew?'<ExtendedAttribute Name="isCreateNew" Value="'+node.frontCondition.isCreateNew+'"/>':'';
    voteModel = node.frontCondition.voteModel!="0"&&node.frontCondition.voteText?'<ExtendedAttribute Name="syncType" Value="'+node.frontCondition.voteModel+'|'+node.frontCondition.voteText+'"/>':'';
    responsible = node.monitorinf.responsible?'<ExtendedAttribute Name="responsible" Value="'+node.monitorinf.responsible.join(',')+'"/>':'<ExtendedAttribute Name="responsible"/>'

    var ExtendedAttributes = 
            '<ExtendedAttributes>'
          +     conventionalXpdl.isMulInstance
          + '   <ExtendedAttribute Name="isResponsibleTem" Value="'+node.monitorinf.isResponsibleTem+'"/>'
          +     responsible
          +     conventionalXpdl.mustActivity
          +     isCreateNew
          +     voteModel
          +     conventionalXpdl.taskAssignMode
          +     conventionalXpdl.assignmentsOrder
          +     conventionalXpdl.completeAllAssignments
          +     conventionalXpdl.autoAcceptAllAssignments
          +     conventionalXpdl.isResponsible
          +     highLevelXpdl
          +     deadlineXpdl.deadline
          + '   <ExtendedAttribute Name="FinishRule"/>'
          + '   <ExtendedAttribute Name="warnTimeiFrequency"/>'
          +     deadlineXpdl.warnTime
          +     deadlineXpdl.warnAgentClassName
          +     deadlineXpdl.limitAgentClassName
          +     conventionalXpdl.participantID
          + '   <ExtendedAttribute Name="XOffset" Value="'+node.x+'"/>'
          + '   <ExtendedAttribute Name="YOffset" Value="'+node.y+'"/>';
    if (extendAttr) {
      for (var i in extendAttr) {
        ExtendedAttributes +=
            '   <ExtendedAttribute Name="'+JSON.parse(extendAttr[i]).name+'" Value="'+JSON.parse(extendAttr[i]).value+'"/>'
      }
    }
    ExtendedAttributes +=
            '</ExtendedAttributes>';
    return ExtendedAttributes;
  }
  //获取常规相应的xpdl
  GraphCreator.prototype.conventionalXpdl = function(node) {
    var thisGraph = this,
      conventional = node.conventional,
      conventionalXpdl = {};
    conventionalXpdl.startMode = conventional.startMode=='automatic'?'<StartMode><Automatic/></StartMode>':'<StartMode><Manual/></StartMode>';
    conventionalXpdl.finishMode = conventional.finishMode=='automatic'?'<FinishMode><Automatic/></FinishMode>':'<FinishMode><Manual/></FinishMode>';
    conventionalXpdl.isMulInstance = conventional.isMulInstance?'<ExtendedAttribute Name="isMulInstance" Value="true"/>':'<ExtendedAttribute Name="isMulInstance" Value="false"/>';
    conventionalXpdl.isResponsible = conventional.isResponsible?'<ExtendedAttribute Name="isResponsible" Value="true"/>':'<ExtendedAttribute Name="isResponsible" Value="false"/>'
    conventionalXpdl.autoAcceptAllAssignments = conventional.autoAcceptAllAssignments?'<ExtendedAttribute Name="autoAcceptAllAssignments" Value="true"/>':'<ExtendedAttribute Name="autoAcceptAllAssignments" Value="false"/>'    
    conventionalXpdl.completeAllAssignments = conventional.completeAllAssignments?'<ExtendedAttribute Name="completeAllAssignments" Value="true"/>':'<ExtendedAttribute Name="completeAllAssignments" Value="false"/>';
    conventionalXpdl.assignmentsOrder = conventional.assignmentsOrder?'<ExtendedAttribute Name="assignmentsOrder" Value="true"/>':'<ExtendedAttribute Name="assignmentsOrder" Value="false"/>'
    conventionalXpdl.description = conventional.description?'<Description>'+conventional.description+'</Description>':'';
    conventionalXpdl.taskAssignMode = '<ExtendedAttribute Name="taskAssignMode" Value="'+conventional.taskAssignMode+'"/>';
    conventionalXpdl.mustActivity = conventional.mustActivity?'<ExtendedAttribute Name="MustActivity" Value="true"/>':'<ExtendedAttribute Name="MustActivity" Value="false"/>';
    conventionalXpdl.participantID = conventional.participantID?'<ExtendedAttribute Name="ParticipantID" Value="'+conventional.participantID+'"/>':'<ExtendedAttribute Name="ParticipantID"/>';
    conventionalXpdl.performer = conventional.performer?'<Performer>'+conventional.performer+'</Performer>':'';
    return conventionalXpdl;
  }
  //获取超时限制相应的xpdl 
  GraphCreator.prototype.deadlineXpdl = function(node) {
    var thisGraph = this,
      timeoutLimit = node.timeoutLimit,
      deadlineXpdl = {};
    deadlineXpdl.limit = timeoutLimit.limitTime?'<Limit>'+timeoutLimit.limitTime+'</Limit>':'';
    deadlineXpdl.warnTime = timeoutLimit.warnTime?'<ExtendedAttribute Name="warnTime" Value="'+timeoutLimit.warnTime+'"/>':'<ExtendedAttribute Name="warnTime"/>';
    deadlineXpdl.warnAgentClassName = timeoutLimit.warnAgentClassName?'<ExtendedAttribute Name="warnAgentClassName" Value="'+timeoutLimit.warnAgentClassName+'"/>':'<ExtendedAttribute Name="warnAgentClassName"/>'
    deadlineXpdl.limitAgentClassName = timeoutLimit.limitAgentClassName?'<ExtendedAttribute Name="limitAgentClassName" Value="'+timeoutLimit.limitAgentClassName+'"/>':'<ExtendedAttribute Name="limitAgentClassName"/>';
    var Deadlines = '',
      deadlines_arr = [];
    for (var i in timeoutLimit.deadline) {
      var deadline = JSON.parse(timeoutLimit.deadline[i]);
      deadlines_arr.push(deadline.exceptionName+','+deadline.deadlineCondition);
      if (deadline.execution == '') {
        Deadlines += '<Deadline>'
                   + '    <DeadlineCondition>'+deadline.deadlineCondition+'</DeadlineCondition>'
                   + '    <ExceptionName>'+deadline.exceptionName+'</ExceptionName>'
                   + '</Deadline>'
      }
      if (deadline.execution == 'SYNCHR') {
        Deadlines += '<Deadline Execution="SYNCHR">'
                   + '    <DeadlineCondition>'+deadline.deadlineCondition+'</DeadlineCondition>'
                   + '    <ExceptionName>'+deadline.exceptionName+'</ExceptionName>'
                   + '</Deadline>'
      }
      if (deadline.execution == 'ASYNCHR') {
        Deadlines += '<Deadline Execution="ASYNCHR">'
                   + '    <DeadlineCondition>'+deadline.deadlineCondition+'</DeadlineCondition>'
                   + '    <ExceptionName>'+deadline.exceptionName+'</ExceptionName>'
                   + '</Deadline>'
      }
    }
    deadlineXpdl.deadlines = Deadlines;
    deadlineXpdl.deadline = deadlines_arr.length>0?'<ExtendedAttribute Name="deadline" Value="'+deadlines_arr.join('|')+'"/>':'<ExtendedAttribute Name="deadline"/>';
    return deadlineXpdl;
  }
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
          transitionRefs += '<TransitionRef Id="'+edge.edgeId+'"/>'
        } else if (edge.target == node){
          numIn++;
        }
      }
    });
    activity_inOut.numIn = numIn;
    activity_inOut.numOut = numOut;
    activity_inOut.transitionRefs = transitionRefs;
    return activity_inOut;
  }
  //获取TransitionRestrictions相应的xpdl
  GraphCreator.prototype.getTransitionRestrictions = function(node, activity_inOut) {
    var join = node.frontCondition.convergeType?'<Join Type="'+node.frontCondition.convergeType+'"/>':'<Join Type="XOR"/>';
    var TransitionRestrictions = '';
    if (activity_inOut.numIn > 1 || activity_inOut.numOut > 1 || node.frontCondition.convergeType) {
      TransitionRestrictions += '  <TransitionRestrictions>'
                              + '      <TransitionRestriction>'
      if (activity_inOut.numIn > 1 || node.frontCondition.convergeType) {  
        TransitionRestrictions +=        join
      }
      if (activity_inOut.numOut > 1) {
        TransitionRestrictions += '      <Split Type="XOR">'
                                + '          <TransitionRefs>'
                                +                activity_inOut.transitionRefs
                                + '          </TransitionRefs>'
                                + '      </Split>'
      }
      TransitionRestrictions += '      </TransitionRestriction>'
                              + '  </TransitionRestrictions>'
    }
    return TransitionRestrictions;
  }
  //生成参与者相应的xpdl
  GraphCreator.prototype.getParticipants = function() {//??细节还有问题：1.isAppData; 2.condition,conditionXml;
    var thisGraph = this;
    if (thisGraph.participants.length == 0) return false;

    var xpdl = '',
      participantsXpdl = '';
    for (var i in thisGraph.participants) {
      var participant = thisGraph.participants[i],
        extendedAttr = '';
      if (participant && participant.conventional_definition_participant) {
        extendedAttr  = '<ExtendedAttribute Name="PartyBeanld" Value="'+participant.conventional_definition_participant+'"/>'
      } else {
        extendedAttr += '<ExtendedAttribute Name="typeName" Value="'+(participant.typeName?participant.typeName.join(','):"")+'"/>'
                      + '<ExtendedAttribute Name="isAppData" Value="false"/>'
                      + '<ExtendedAttribute Name="itemName" Value="'+(participant.itemName?participant.itemName.join(','):"")+'"/>'
                      + '<ExtendedAttribute Name="itemValue" Value="'+(participant.itemValue?participant.itemValue.join(','):"")+'"/>'
                      + '<ExtendedAttribute Name="secLevelS" Value="'+(participant.secLevelS?participant.secLevelS.join(','):"")+'"/>'
                      + '<ExtendedAttribute Name="secLevelE" Value="'+(participant.secLevelE?participant.secLevelE.join(','):"")+'"/>'
                      + (participant.condition?'<ExtendedAttribute Name="condition"><![CDATA['+participant.condition.join(',')+'fw==]]></ExtendedAttribute>':'<ExtendedAttribute Name="condition"/>')
                      + '<ExtendedAttribute Name="conditionXml"/>'
                      + '<ExtendedAttribute Name="roleName" Value="'+(participant.roleName?participant.roleName.join(','):"")+'"/>'
      }
      participantsXpdl += '<Participant Id="'+participant.conventional_definition_id+'" Name="'+(participant.conventional_definition_name || "")+'">'
                        + '    <ParticipantType Type="ROLE"/>'
                        + '    <Description>'+participant.conventional_definition_participant+'</Description>'
                        + '    <ExtendedAttributes>'
                        +         extendedAttr
                        + '    </ExtendedAttributes>'
                        + '</Participant>'
    }
    xpdl += '<Participants>'
          +     participantsXpdl
          + '</Participants>'
    return xpdl;
  }
  //生成所有activity xml添加至xmlContainer
  GraphCreator.prototype.emergeAllXmlContent = function() {
    var thisGraph = this;
    var start = '<WorkflowProcess Id="'+workflow_id+'" Name="'+workflow_name+'" endform-id="" endformschema="">',
          end = '  <text-limit/>'+
                '</WorkflowProcess>';

    var nodes = thisGraph.nodes,
      curText = start,
      activity = '';
    for (var i in nodes) {
      if (nodes[i].type == 'activity') {
        activity = '<activity Id="'+nodes[i].id+'" Name="'+nodes[i].title+'" form-id="" formdisplayschema="" hisformdisplayschema="">'+
                   '  <operations/>'+
                   '  <text-limit/>'+
                   '</activity>';
        curText += activity;
      }
    }
    curText += end;
    curText = vkbeautify.xml(curText);
    return curText;
  }
  //生成所有activity xml添加至xpdlContainer
  GraphCreator.prototype.emergeAllxpdlContent = function() {
    var thisGraph = this;
    var nodes = thisGraph.nodes;
    var edges = thisGraph.edges;
    var activitySets = '';
    if(nodes.length>0){
      activitySets = //不清楚什么时候设置??
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
          for (var i in edges) {
            if (edges[i].source == node) {
               nodes_start += '<ExtendedAttribute Name="StartOfWorkflow" Value="none;'+edges[i].target.id+';'+node.x+';'+node.y+';NOROUTING"/>'
            }
          }
        }
        if (node.type == 'end') {
          for (var i in edges) {
            if (edges[i].target == node) {
               nodes_end += '<ExtendedAttribute Name="EndOfWorkflow" Value="none;'+edges[i].source.id+';'+node.x+';'+node.y+';NOROUTING"/>'
            }
          }
        }
    })
    nodes_act.forEach(function (node) {
      var activity_inOut = thisGraph.activityInOutNum(node);
      var deadlineXpdl = thisGraph.deadlineXpdl(node);
      var conventionalXpdl = thisGraph.conventionalXpdl(node);
      switch (node.component) {
        case "activityComponent"://普通活动
          activities 
             += '<Activity Id="'+node.id+'" Name="'+node.title+'">'
              +      deadlineXpdl.limit
              +      conventionalXpdl.description
              + '    <Implementation>'
              + '        <No/>'
              + '    </Implementation>'
              +      conventionalXpdl.performer
              +      conventionalXpdl.startMode
              +      conventionalXpdl.finishMode
              + '    <Priority/>'
              +      deadlineXpdl.deadlines
              +      thisGraph.getTransitionRestrictions(node, activity_inOut)
              +      thisGraph.getExtendedAttributes(node, deadlineXpdl, conventionalXpdl)
              + '</Activity>';
          break;
        case "blockActivity": //块活动
          activities
             += '<Activity Id="'+node.id+'" Name="'+node.title+'">'
              +      deadlineXpdl.limit
              +      conventionalXpdl.description
              + '    <BlockActivity BlockId="Package_H00387DJ_Wor1_Ase2"/>'
              +      conventionalXpdl.performer
              +      conventionalXpdl.startMode
              +      conventionalXpdl.finishMode
              + '    <Priority/>'
              +      deadlineXpdl.deadlines
              +      thisGraph.getTransitionRestrictions(node, activity_inOut)
              +      thisGraph.getExtendedAttributes(node, deadlineXpdl, conventionalXpdl)
              + '</Activity>';   
          break;
        case "subFlowActivity": //子活动
          activities
             += '<Activity Id="'+node.id+'" Name="'+node.title+'">'
              +      deadlineXpdl.limit
              +      conventionalXpdl.description
              + '    <Implementation>'
              + '        <SubFlow Execution="SYNCHR" Id="Package_6MT7F8C0_Wor4"/>'//subFlowId是什么东西??
              + '    </Implementation>'
              +      conventionalXpdl.performer
              +      conventionalXpdl.startMode
              +      conventionalXpdl.finishMode
              + '    <Priority/>'
              +      deadlineXpdl.deadlines
              +      thisGraph.getTransitionRestrictions(node, activity_inOut)
              +      thisGraph.getExtendedAttributes(node, deadlineXpdl, conventionalXpdl)
              + '</Activity>';
          break;
        case "routeActivity": //路径活动
          activities
             += '<Activity Id="'+node.id+'" Name="'+node.title+'">'
              +      deadlineXpdl.limit
              +      conventionalXpdl.description
              + '    <Route/>'
              +      conventionalXpdl.performer
              +      conventionalXpdl.startMode
              +      conventionalXpdl.finishMode
              + '    <Priority/>'
              +      deadlineXpdl.deadlines
              +      thisGraph.getTransitionRestrictions(node, activity_inOut)
              +      thisGraph.getExtendedAttributes(node, deadlineXpdl, conventionalXpdl)
              + '</Activity>';
          break;
        }
    });
    var transitions = "";
    edges.forEach(function(edge) {
        transitions
          += '<Transition From="'+edge.source.id+'" Id="'+edge.edgeId+'" To="'+edge.target.id+'">'
           + '    <Condition/>'
           + '    <ExtendedAttributes>'
           + '        <ExtendedAttribute Name="TransitionRuleType"/>'
           + '        <ExtendedAttribute Name="TransitionEventType" Value="transitionClass"/>'
           + '        <ExtendedAttribute Name="conditype"/>'
           + '        <ExtendedAttribute Name="RoutingType" Value="NOROUTING"/>'
           + '    </ExtendedAttributes>'
           + '</Transition>'
    });
    var str
        = '<WorkflowProcesses>'
        + '   <WorkflowProcess AccessLevel="PUBLIC" Id="'+workflow_id+'" Name="'+workflow_name+'">'
        + '       <ProcessHeader DurationUnit="D">'
        + '           <Created>'+creat_time+'</Created>'
        + '           <Priority/>'
        + '       </ProcessHeader>'
        + '       <RedefinableHeader PublicationStatus="UNDER_TEST">'
        + '           <Author>管理员</Author>'
        + '           <Version>1.0</Version>'
        + '       </RedefinableHeader>'
        +         thisGraph.getParticipants()
        + '       <Applications>'
        + '           <Application Id="workflow_DefaultToolAgent" Name="执行其他的toolagent">'
        + '               <Description>执行其他的toolagent</Description>'
        + '               <FormalParameters>'
        + '                   <FormalParameter Id="ToolAgentClass" Index="0" Mode="IN">'
        + '                       <DataType>'
        + '                           <ExternalReference location="java.lang.String"/>'
        + '                       </DataType>'
        + '                       <Description>其他组件名称</Description>'
        + '                   </FormalParameter>'
        + '               </FormalParameters>'
        + '               <ExtendedAttributes>'
        + '                   <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.DefaultToolAgent"/>'
        + '                   <ExtendedAttribute Name="ToolAgentClass"/>'
        + '               </ExtendedAttributes>'
        + '           </Application>'
        + '           <Application Id="workflow_sendMailToolAgent" Name="发送邮件">'
        + '               <Description>发送电子邮件</Description>'
        + '               <FormalParameters>'
        + '                   <FormalParameter Id="body" Index="body" Mode="IN">'
        + '                       <DataType>'
        + '                           <BasicType Type="STRING"/>'
        + '                       </DataType>'
        + '                       <Description>邮件正文</Description>'
        + '                   </FormalParameter>'
        + '                   <FormalParameter Id="subject" Index="subject" Mode="IN">'
        + '                       <DataType>'
        + '                           <BasicType Type="STRING"/>'
        + '                       </DataType>'
        + '                       <Description>邮件标题</Description>'
        + '                   </FormalParameter>'
        + '                   <FormalParameter Id="to" Index="to" Mode="IN">'
        + '                       <DataType>'
        + '                           <BasicType Type="STRING"/>'
        + '                       </DataType>'
        + '                       <Description>邮件地址,多个使用 , 分割</Description>'
        + '                   </FormalParameter>'
        + '               </FormalParameters>'
        + '               <ExtendedAttributes>'
        + '                   <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.sendMailToolAgent"/>'
        + '               </ExtendedAttributes>'
        + '           </Application>'
        + '           <Application Id="workflow_dbToolAgent" Name="修改数据">'
        + '               <Description>修改数据库数据</Description>'
        + '               <FormalParameters>'
        + '                   <FormalParameter Id="tableName" Index="0" Mode="IN">'
        + '                       <DataType>'
        + '                           <ExternalReference location="java.lang.String"/>'
        + '                       </DataType>'
        + '                       <Description>数据表名称</Description>'
        + '                   </FormalParameter>'
        + '                   <FormalParameter Id="dbdata" Index="1" Mode="IN">'
        + '                       <DataType>'
        + '                           <ExternalReference location="java.lang.Object"/>'
        + '                       </DataType>'
        + '                       <Description>需要操作的数据可以是一个String,pojo或者Map</Description>'
        + '                   </FormalParameter>'
        + '                   <FormalParameter Id="DbActionType" Index="2" Mode="IN">'
        + '                       <DataType>'
        + '                           <BasicType Type="INTEGER"/>'
        + '                       </DataType>'
        + '                       <Description>对数据库的操作类型，取值：1 增加 2 修改 3 删除</Description>'
        + '                   </FormalParameter>'
        + '                   <FormalParameter Id="Condition" Index="3" Mode="IN">'
        + '                       <DataType>'
        + '                           <ExternalReference location="java.lang.Object"/>'
        + '                       </DataType>'
        + '                       <Description>数据操作条件，可以为pojo或者Map,为数据的操作条件</Description>'
        + '                   </FormalParameter>'
        + '               </FormalParameters>'
        + '               <ExtendedAttributes>'
        + '                   <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.dbToolAgent"/>'
        + '                   <ExtendedAttribute Name="DataTableName"/>'
        + '               </ExtendedAttributes>'
        + '           </Application>'
        + '           <Application Id="workflow_fetchDataAgent" Name="获取数据">'
        + '               <Description>获取数据库数据</Description>'
        + '               <FormalParameters>'
        + '                   <FormalParameter Id="Condition" Index="1" Mode="IN">'
        + '                       <DataType>'
        + '                           <ExternalReference location="java.lang.Object"/>'
        + '                       </DataType>'
        + '                       <Description>数据操作条件，可以为pojo或者Map,为数据的操作条件</Description>'
        + '                   </FormalParameter>'
        + '               </FormalParameters>'
        + '               <ExtendedAttributes>'
        + '                   <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.fetchDataAgent"/>'
        + '                   <ExtendedAttribute Name="DataTableName"/>'
        + '               </ExtendedAttributes>'
        + '           </Application>'
        + '       </Applications>'
    if (nodes_act.length > 0) {
      str
       += '       <Activities>'
        +             activities
        + '       </Activities>'
    }
    if (edges.length > 0) {
      str
       += '       <Transitions>'
        +             transitions     
        + '       </Transitions>'
    }
    str
       += '       <ExtendedAttributes>'
        + '           <ExtendedAttribute Name="IsMain" Value="true"/>'
        + '           <ExtendedAttribute Name="warnTimeiFrequency"/>'
        + '           <ExtendedAttribute Name="warnTime"/>'
        + '           <ExtendedAttribute Name="warnAgentClassName"/>'
        + '           <ExtendedAttribute Name="LimitAgentClassName"/>'
        + '           <ExtendedAttribute Name="initFormPlugin" Value="wfd_form.xml"/>'
        + '           <ExtendedAttribute Name="initReserve"/>'
        + '           <ExtendedAttribute Name="initType" Value="money"/>'
        + '           <ExtendedAttribute Name="initAuthor" Value="管理员"/>'
        +             nodes_start
        +             nodes_end
        + '       </ExtendedAttributes>'
        + '   </WorkflowProcess>'
        + '</WorkflowProcesses>'
    str = vkbeautify.xml(str);
    return str;
  }

  GraphCreator.prototype.setIdCt = function(idct) {
    this.idct = idct;
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
    nodeRadius: 40
  };

  /* PROTOTYPE FUNCTIONS */
  GraphCreator.prototype.dragmove = function(d) {
    var thisGraph = this;
    if (thisGraph.state.shiftNodeDrag||thisGraph.state.drawLine) {
      thisGraph.dragLine.attr('d', 'M' + d.x + ',' + d.y + 'L' + d3.mouse(thisGraph.svgG.node())[0] + ',' + d3.mouse(this.svgG.node())[1]);
    } else {
      d.x += d3.event.dx;
      d.y += d3.event.dy;
      thisGraph.updateGraph();
    }
  };

  GraphCreator.prototype.deleteGraph = function(skipPrompt) {
    var thisGraph = this,
      doDelete = true;
    if (!skipPrompt) {
      doDelete = window.confirm("确认清空？");
    }
    if (doDelete) {
      thisGraph.nodes = [];
      thisGraph.edges = [];
      thisGraph.updateGraph();
    }
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
      }
    }
  };

  // mousedown on node
  GraphCreator.prototype.circleMouseDown = function(d3node, d) {
    var thisGraph = this,
      state = thisGraph.state;
    d3.event.stopPropagation();
    state.mouseDownNode = d;

    if (d3.event.shiftKey||thisGraph.state.drawLine) {
        // Automatically create node when they shift + drag?
      state.shiftNodeDrag = d3.event.shiftKey;
      // reposition dragged directed edge
      thisGraph.dragLine.classed('hidden', false)
        .attr('d', 'M' + d.x + ',' + d.y + 'L' + d.x + ',' + d.y);
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
        '  <div name="type" class="prop-value"><span>类型:</span><span>null</span></div>'+
        '  <div name="" class="prop-value"><span>执行者:</span><span>无</span></div>'+
        '</div>'+
        '<div class="clearfix"></div>');
  }

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
      // we're in a different node: create new edge for mousedown edge and add to graph
      var newEdge = {
        edgeId: workflow_id + '_Tra' + thisGraph.edgeNum++,
        source: mouseDownNode,
        target: d
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
      if (state.justDragged) {
        // dragged, not clicked
        state.justDragged = false;
        if (state.selectedEdge) {
          thisGraph.removeSelectFromEdge();
        }
        var prevNode = state.selectedNode;
        if (!prevNode || prevNode.id !== d.id) {
          thisGraph.replaceSelectNode(d3node, d);
          thisGraph.changePropDiv(d);//添加更改属性div
        } else {
          // thisGraph.removeSelectFromNode();
        }
      
      } else {
        // clicked, not dragged
        if (d3.event.shiftKey) {
          // shift-clicked node: edit text content
        //   var d3txt = thisGraph.changeTextOfNode(d3node, d);
        //   var txtNode = d3txt.node();
        //   thisGraph.selectElementContents(txtNode);
        //   txtNode.focus();

        } else {
          if (state.selectedEdge) {
            thisGraph.removeSelectFromEdge();
          }
          var prevNode = state.selectedNode;

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
      console.log(thisGraph.svgG);
      console.log(thisGraph.svgG.node());
      var xycoords = d3.mouse(thisGraph.svgG.node()),
        d = {
          id: Word+'_node_'+randomWord(false,4)+thisGraph.idct++,
          title: '普通活动',
          component: 'activityComponent',
          type: 'activity',
          x: xycoords[0],
          y: xycoords[1],
          frontCondition: {},
          extendAttr: [],
          highLevel: {},
          timeoutLimit: {},
          eventTypeId: null
        };
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
    } else if (state.shiftNodeDrag||state.drawLine) {
      // dragged from node
      state.shiftNodeDrag = false;
      thisGraph.dragLine.classed("hidden", true);
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

    switch (d3.event.keyCode) {
      /*case consts.BACKSPACE_KEY:*/
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
    }
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
    paths.style('marker-end', 'url(#end-arrow)')
      .classed(consts.selectedClass, function(d) {
        return d === state.selectedEdge;
      })
      .attr("d", function(d) {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
      });

    // add new paths
    paths.enter()
      .append("path")
      .style('marker-end', 'url(#end-arrow)')
      .classed("link", true)
      .attr("d", function(d) {
        return "M" + d.source.x + "," + d.source.y + "L" + d.target.x + "," + d.target.y;
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
    d3.select("." + this.consts.graphClass)
      .attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
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
 * [generateUUID 返回一串序列码]
 * @return {String} [uuid]
 */
function generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};
/** 
 * randomWord 产生任意长度随机字母数字组合
 * randomFlag-是否任意长度 min-任意长度最小位[固定位数] max-任意长度最大位
 * xuanfeng 2014-08-28
 */
function randomWord(randomFlag, min, max){
    var str = "",
        range = min,
        arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    if(randomFlag){
        range = Math.round(Math.random() * (max-min)) + min;
    }
    for(var i=0; i<range; i++){
        pos = Math.round(Math.random() * (arr.length-1));
        str += arr[pos];
    }
    return str;
}
