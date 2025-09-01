(function($){
  $(function(){
    function makeSortable($container){
      $container.sortable({
        items: '> li',
        handle: '.wqb-drag-handle',
        placeholder: 'wqb-sort-placeholder',
        forcePlaceholderSize: true,
        tolerance: 'pointer'
      })
    }

    $('.wqb-sortable').each(function(){
      makeSortable($(this))
    })

    $('#wqb-category-order-form').on('submit', function(){
      // Build a map parentId -> [ordered child ids]
      var orderMap = {}

      function captureList($ul, parentId){
        var ids = []
        $ul.children('li.wqb-category-item').each(function(){
          var id = parseInt($(this).attr('data-term-id'), 10)
          if (!isNaN(id)) { ids.push(id) }

          var $childUl = $(this).children('ul.wqb-sortable').first()
          if ($childUl.length){
            captureList($childUl, id)
          }
        })
        orderMap[String(parentId)] = ids
      }

      var $root = $('#wqb-category-root')
      if ($root.length){
        captureList($root, 0)
      }

      $('#wqb-category-order-json').val(JSON.stringify(orderMap))
    })
  })
})(jQuery)


