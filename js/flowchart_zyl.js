document.onload = (function(d3, saveAs, Blob, undefined) {
  "use strict";

  // define graphcreator object
  var GraphCreator = function(svg, nodes, edges) {
    var thisGraph = this;
    console.log('thisGraph:');
    console.log(thisGraph);

    thisGraph.idct = 0;

    thisGraph.nodes = nodes || [];
    thisGraph.edges = edges || [];

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
          // TODO  the internal d3 state is still changing
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
    d3.select("#help").on("click", function(){
      $('#helpbox').removeClass('hidden');
    });

    // reset zoom
    d3.select("#reset-zoom").on("click", function(){
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
          // TODO better error handling
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

    $('#flowComponents .components-btn').not('.noComponent').attr('draggable','true').on('dragstart', function(ev){
      ev.originalEvent.dataTransfer.setData('text', $(this).children('span').text());
      ev.originalEvent.dataTransfer.setData('shapename', $(this).attr('for-name'));
      ev.originalEvent.dataTransfer.setData('component', $(this).attr('name'));
      console.log('drag start');
      console.log('shapename:'+$(this).attr('for-name')+';shapeLabel:'+$(this).children('span').text());
      // $('#reset-zoom').trigger("click");
    });
    $('#container').on('drop', function(ev){
      var position ={};
      position.x = parseInt(ev.originalEvent.offsetX),
      position.y = parseInt(ev.originalEvent.offsetY);
      var shapeLabel = ev.originalEvent.dataTransfer.getData('text'),
        shapename = ev.originalEvent.dataTransfer.getData('shapename'),
        component = ev.originalEvent.dataTransfer.getData('component'),
        shapeId = shapename + new Date().getTime();

      var d = {
          id: Word+'_node_'+randomWord(false,4)+thisGraph.idct++,
          title: shapeLabel,
          component: component,
          x: position.x,
          y: position.y,
          eventTypeId: null
        };
      thisGraph.nodes.push(d);
      thisGraph.updateGraph();
      //生成xml文件
      // var data = {activity: d};
      // thisGraph.emergeXmlContent(d);
    }).on('dragover', function(ev){
      ev.preventDefault();
      console.log('drag over');
    });
    //选择左侧工具
    $('#flowComponents .components-btn').on('click', function(){
      $(this).siblings().removeClass('active').end().addClass('active');
      if('drawLineBtn'==$(this).attr('name')){
        thisGraph.state.drawLine = true;
        $('#container').on('mouseover mouseout', '.conceptG', function(){
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
    $('.menu .item').on('click', function () {
      var dataTab = $(this).attr('data-tab');
      if(dataTab=='third'){ //xml视图
        thisGraph.emergeAllXmlContent();
      }
      if(dataTab=='second'){ //xpdl视图
        thisGraph.emergeAllxpdlContent();
      }
    });
    //点击导入导出按钮
    $('.editor-toolbar').on('click', '.sign.in,.sign.out', function(event) {
      var isImport = $(this).hasClass('in');
      $('.ui.modal').modal({
        onDeny: function(){
          // window.alert('取消!');
        },
        onApprove: function() {
          if(isImport){
            var jsonStr = $('div.json_data textarea').val();
            if(jsonStr){
              var json = JSON.parse(jsonStr);
              var edges = [];
              var nodes =json.nodes;
              for(var i in json.edges){
                var source = json.edges[i].source.id;
                var target = json.edges[i].target.id;
                var edge = {};
                for(var j in json.nodes){
                  var node = json.nodes[j].id
                  if(source==node){
                    edge.source = nodes[j];
                  }
                  if(target==node){
                    edge.target = nodes[j];
                  }
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
          $('#div.json_data input,textarea').val('');
        }
      })
      .modal('setting', 'transition', 'scale')
      .modal('show');

      if($(this).hasClass('in')){
        $('div.json_data .header').text('导入数据');
      }else{
        $('div.json_data .header').text('导出数据');
        var json = {};
        json.nodes = thisGraph.nodes;
        json.edges = thisGraph.edges;
        console.log(JSON.stringify(json));
        $('div.json_data textarea').val(JSON.stringify(json));
      }
    });
    
  };
  //生成activity xml并添加至xmlContainer
  GraphCreator.prototype.emergeXmlContent = function(data){
    var thisGraph = this;
    var text = $('#xmlContainer xmp').text(),
      start = text.substring(0, text.lastIndexOf('<text-limit/>')),
      end = '  '+text.substring(text.lastIndexOf('<text-limit/>')),
      activity = '<activity Id="'+data.id+'" Name="'+data.title+'" form-id="" formdisplayschema="" hisformdisplayschema="">\n'+
                 '    <operations/>\n'+
                 '    <text-limit/>\n'+
                 '  </activity>\n';
    var curText = start + activity + end;
    $('#xmlContainer xmp').empty().text(curText);
  }
  //生成所有activity xml添加至xmlContainer
  GraphCreator.prototype.emergeAllXmlContent = function(){
    var thisGraph = this;
    $('#xmlContainer xmp').empty();

    var start = '<WorkflowProcess Id="'+workflow_id+'" Name="'+workflow_name+'" endform-id="" endformschema="">\n',
          end = '  <text-limit/>\n'+
                '</WorkflowProcess>';

    var nodes = thisGraph.nodes,
      curText = '' + start,
      activity = '';
    for(var i in nodes){
      if(nodes[i].component=='activityComponent'){
        activity = '  <activity Id="'+nodes[i].id+'" Name="'+nodes[i].title+'" form-id="" formdisplayschema="" hisformdisplayschema="">\n'+
                   '    <operations/>\n'+
                   '    <text-limit/>\n'+
                   '  </activity>\n';
        curText += activity;
      }
    }
    curText += end;
    $('#xmlContainer xmp').empty().text(curText);
  }
  //生成所有activity xml添加至xpdlContainer
  GraphCreator.prototype.emergeAllxpdlContent = function(){
    var thisGraph = this;
    var start = 
      '<WorkflowProcesses>\n'+
      '  <WorkflowProcess AccessLevel="PUBLIC" Id="'+workflow_id+'" Name="'+workflow_name+'">\n'+
      '    <ProcessHeader DurationUnit="D">\n'+
      '      <Created>'+creat_time+'</Created>\n'+
      '      <Priority/>\n'+
      '    </ProcessHeader>\n'+
      '    <RedefinableHeader PublicationStatus="UNDER_TEST">\n'+
      '      <Author>管理员</Author>\n'+
      '      <Version>1.0</Version>\n'+
      '    </RedefinableHeader>\n'+
      '    <Applications>\n'+
      '      <Application Id="workflow_DefaultToolAgent" Name="执行其他的toolagent">\n'+
      '        <Description>执行其他的toolagent</Description>\n'+
      '        <FormalParameters>\n'+
      '          <FormalParameter Id="ToolAgentClass" Index="0" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <ExternalReference location="java.lang.String"/>\n'+
      '            </DataType>\n'+
      '            <Description>其他组件名称</Description>\n'+
      '          </FormalParameter>\n'+
      '        </FormalParameters>\n'+
      '        <ExtendedAttributes>\n'+
      '          <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.DefaultToolAgent"/>\n'+
      '          <ExtendedAttribute Name="ToolAgentClass"/>\n'+
      '        </ExtendedAttributes>\n'+
      '      </Application>\n'+
      '      <Application Id="workflow_sendMailToolAgent" Name="发送邮件">\n'+
      '        <Description>发送电子邮件</Description>\n'+
      '        <FormalParameters>\n'+
      '          <FormalParameter Id="body" Index="body" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <BasicType Type="STRING"/>\n'+
      '            </DataType>\n'+
      '            <Description>邮件正文</Description>\n'+
      '          </FormalParameter>\n'+
      '          <FormalParameter Id="subject" Index="subject" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <BasicType Type="STRING"/>\n'+
      '            </DataType>\n'+
      '            <Description>邮件标题</Description>\n'+
      '          </FormalParameter>\n'+
      '          <FormalParameter Id="to" Index="to" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <BasicType Type="STRING"/>\n'+
      '            </DataType>\n'+
      '            <Description>邮件地址,多个使用 , 分割</Description>\n'+
      '          </FormalParameter>\n'+
      '        </FormalParameters>\n'+
      '        <ExtendedAttributes>\n'+
      '          <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.sendMailToolAgent"/>\n'+
      '        </ExtendedAttributes>\n'+
      '      </Application>\n'+
      '      <Application Id="workflow_dbToolAgent" Name="修改数据">\n'+
      '        <Description>修改数据库数据</Description>\n'+
      '        <FormalParameters>\n'+
      '          <FormalParameter Id="tableName" Index="0" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <ExternalReference location="java.lang.String"/>\n'+
      '            </DataType>\n'+
      '            <Description>数据表名称</Description>\n'+
      '          </FormalParameter>\n'+
      '          <FormalParameter Id="dbdata" Index="1" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <ExternalReference location="java.lang.Object"/>\n'+
      '            </DataType>\n'+
      '            <Description>需要操作的数据可以是一个String,pojo或者Map</Description>\n'+
      '          </FormalParameter>\n'+
      '          <FormalParameter Id="DbActionType" Index="2" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <BasicType Type="INTEGER"/>\n'+
      '            </DataType>\n'+
      '            <Description>对数据库的操作类型，取值：1 增加 2 修改 3 删除</Description>\n'+
      '          </FormalParameter>\n'+
      '          <FormalParameter Id="Condition" Index="3" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <ExternalReference location="java.lang.Object"/>\n'+
      '            </DataType>\n'+
      '            <Description>数据操作条件，可以为pojo或者Map,为数据的操作条件</Description>\n'+
      '          </FormalParameter>\n'+
      '        </FormalParameters>\n'+
      '        <ExtendedAttributes>\n'+
      '          <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.dbToolAgent"/>\n'+
      '          <ExtendedAttribute Name="DataTableName"/>\n'+
      '        </ExtendedAttributes>\n'+
      '      </Application>\n'+
      '      <Application Id="workflow_fetchDataAgent" Name="获取数据">\n'+
      '        <Description>获取数据库数据</Description>\n'+
      '        <FormalParameters>\n'+
      '          <FormalParameter Id="Condition" Index="1" Mode="IN">\n'+
      '            <DataType>\n'+
      '              <ExternalReference location="java.lang.Object"/>\n'+
      '            </DataType>\n'+
      '            <Description>数据操作条件，可以为pojo或者Map,为数据的操作条件</Description>\n'+
      '          </FormalParameter>\n'+
      '        </FormalParameters>\n'+
      '        <ExtendedAttributes>\n'+
      '          <ExtendedAttribute Name="ToolAgentClassName" Value="workflow.fetchDataAgent"/>\n'+
      '          <ExtendedAttribute Name="DataTableName"/>\n'+
      '        </ExtendedAttributes>\n'+
      '      </Application>\n'+
      '    </Applications>\n';    

    var end = 
      '    <ExtendedAttributes>\n'+
      '      <ExtendedAttribute Name="IsMain" Value="true"/>\n'+
      '      <ExtendedAttribute Name="warnTimeiFrequency"/>\n'+
      '      <ExtendedAttribute Name="warnTime"/>\n'+
      '      <ExtendedAttribute Name="warnAgentClassName"/>\n'+
      '      <ExtendedAttribute Name="LimitAgentClassName"/>\n'+
      '      <ExtendedAttribute Name="initFormPlugin" Value="wfd_form.xml"/>\n'+
      '      <ExtendedAttribute Name="initReserve"/>\n'+
      '      <ExtendedAttribute Name="initType" Value="money"/>\n'+
      '      <ExtendedAttribute Name="initAuthor" Value="管理员"/>\n'+
      '    </ExtendedAttributes>\n'+
      '  </WorkflowProcess>\n'+
      '</WorkflowProcesses>';
    var nodes = thisGraph.nodes;
    var activity = '';
    if(nodes.length>0){
      start = start + 
      '    <ActivitySets>\n'+
      '      <ActivitySet Id="Package_8VRAH3EM_Wor1_Ase1"/>\n'+
      '    </ActivitySets>\n';
      end = '    </Activities>\n'+end;
    }
    var curText = '' + start;
    for(var i in nodes){
      if(nodes[i].component=='activityComponent'){
        activity = '    <Activity Id="'+nodes[i].id+'" Name="'+nodes[i].title+'">\n'+
                   '      <Implementation>\n'+
                   '        <No/>\n'+
                   '      </Implementation>\n'+
                   '      <StartMode>\n'+
                   '        <Manual/>\n'+
                   '      </StartMode>\n'+
                   '      <FinishMode>\n'+
                   '        <Manual/>\n'+
                   '      </FinishMode>\n'+
                   '      <Priority/>\n'+
                   '      <ExtendedAttributes>\n'+
                   '        <ExtendedAttribute Name="isMulInstance" Value="false"/>\n'+
                   '        <ExtendedAttribute Name="isResponsibleTem" Value="true"/>\n'+
                   '        <ExtendedAttribute Name="responsible"/>\n'+
                   '        <ExtendedAttribute Name="MustActivity" Value="true"/>\n'+
                   '        <ExtendedAttribute Name="taskAssignMode" Value="taskAutoMode"/>\n'+
                   '        <ExtendedAttribute Name="assignmentsOrder" Value="false"/>\n'+
                   '        <ExtendedAttribute Name="completeAllAssignments" Value="false"/>\n'+
                   '        <ExtendedAttribute Name="autoAcceptAllAssignments" Value="true"/>\n'+
                   '        <ExtendedAttribute Name="isResponsible" Value="true"/>\n'+
                   '        <ExtendedAttribute Name="deadline"/>\n'+
                   '        <ExtendedAttribute Name="FinishRule"/>\n'+
                   '        <ExtendedAttribute Name="warnTimeiFrequency"/>\n'+
                   '        <ExtendedAttribute Name="warnTime"/>\n'+
                   '        <ExtendedAttribute Name="warnAgentClassName"/>\n'+
                   '        <ExtendedAttribute Name="LimitAgentClassName"/>\n'+
                   '        <ExtendedAttribute Name="ParticipantID"/>\n'+
                   '        <ExtendedAttribute Name="XOffset" Value="'+nodes[i].x+'"/>\n'+
                   '        <ExtendedAttribute Name="YOffset" Value="'+nodes[i].y+'"/>\n'+
                   '      </ExtendedAttributes>\n'+
                   '    </Activity>\n'
        curText += activity;
      }
    }
    curText += end;
    $('#xpdlContainer xmp').empty().text(curText);
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
    nodeRadius: 50
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
      doDelete = window.confirm("Press OK to delete this graph");
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

    /*d3.json("js/processes.json", function(error, json){

      json = _.sortBy(json, function(d){ return d.Value })

      if(error){
        alert("Error occured while getting processes. Check console for details.");
        console.log(error);
        return;
      }

      var inspector = d3.select("div#container").append("div").attr({ id: "inspector"});
      var sel = inspector.append("select")
          .on("change", function(d){
            // Update thisGraph.nodes and graph text with selected option.
            var selectedOption = this.options[this.selectedIndex];
            // selectedOption.value & selectedOption.text

            d3Node.select("text").remove();
            thisGraph.insertTitleLinebreaks(d3Node, selectedOption.text);
            nodeData.eventTypeId = parseInt(selectedOption.value);
            nodeData.title = selectedOption.text;

            // console.log('thisGraph.nodes');
            // console.log(thisGraph.nodes);

          });


      var options = sel.selectAll("option");

      options.data(json).enter()
          .append("option")
              .attr({value: function(d){ return d.Key }})
              .text(function(d){ return d.Value })
          .property("selected", function(d, i){
                return d.Key === nodeData.eventTypeId;
          });

    });*/
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
      thisGraph.removeSelectFromEdge();
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
    console.log('circle mouse up');
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
            thisGraph.removeSelectFromNode();
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
          id: thisGraph.idct++,
          title: "",
          x: xycoords[0],
          y: xycoords[1],
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
      case consts.BACKSPACE_KEY:
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
        console.log('on mouse down d:');
        console.log(d);
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
  graph.setIdCt(2);
  graph.updateGraph();
  /*var graph = new GraphCreator(svg, [], []);
  // graph.setIdCt(2);
  graph.updateGraph();*/

})(window.d3, window.saveAs, window.Blob);

function generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};
/*
** randomWord 产生任意长度随机字母数字组合
** randomFlag-是否任意长度 min-任意长度最小位[固定位数] max-任意长度最大位
** xuanfeng 2014-08-28
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
